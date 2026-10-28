// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp;

import com.agerp.agerp.dto.ItemPedidoRequest;
import com.agerp.agerp.dto.PedidoCreateRequest;
import com.agerp.agerp.entity.Cliente;
import com.agerp.agerp.entity.Estoque;
import com.agerp.agerp.entity.Produto;
import com.agerp.agerp.repository.ClienteRepository;
import com.agerp.agerp.repository.EstoqueRepository;
import com.agerp.agerp.repository.ProdutoRepository;
import com.agerp.agerp.repository.UsuarioRepository;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.service.PedidoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/** Executa transações de negócio concorrentes apenas no PostgreSQL descartável do Testcontainers. */
@SpringBootTest(properties = "agerp.seed.enabled=true")
@Import(TestcontainersConfiguration.class)
class PedidoAuditoriaConcorrenciaIntegrationTest {
    @Autowired private PedidoService pedidos;
    @Autowired private ClienteRepository clientes;
    @Autowired private ProdutoRepository produtos;
    @Autowired private EstoqueRepository estoques;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlatformTransactionManager txManager;

    private CustomUserDetails admin;

    @BeforeEach
    void setup() {
        admin = new TransactionTemplate(txManager).execute(tx -> {
            var user = usuarios.findAll().stream()
                    .filter(u -> "ADMIN".equalsIgnoreCase(u.getIdPerfil().getNome()))
                    .findFirst().orElseThrow();
            return new CustomUserDetails(user, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        });
    }

    private void authenticate() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities()));
    }

    private record Fixture(int clientId, int productId) {}

    private Fixture fixture(int availableStock) {
        return new TransactionTemplate(txManager).execute(tx -> {
            String marker = UUID.randomUUID().toString();
            Cliente cliente = new Cliente();
            cliente.setNomeRazao("Teste isolado " + marker);
            cliente.setTipo("FISICA");
            cliente.setEmail("isolated-" + marker + "@example.invalid");
            cliente = clientes.saveAndFlush(cliente);

            Produto produto = new Produto();
            produto.setNome("Teste concorrencia " + marker);
            produto.setPreco(BigDecimal.valueOf(12));
            produto.setAtivo(true);
            produto = produtos.saveAndFlush(produto);

            Estoque estoque = new Estoque();
            estoque.setIdProduto(produto);
            estoque.setQuantidadeAtual(availableStock);
            estoque.setQuantidadeMinima(0);
            estoques.saveAndFlush(estoque);
            return new Fixture(cliente.getId(), produto.getId());
        });
    }

    private int createOrder(Fixture fixture, int quantity) {
        authenticate();
        try {
            return pedidos.criar(new PedidoCreateRequest(fixture.clientId(), null,
                    List.of(new ItemPedidoRequest(fixture.productId(), quantity)), null)).getId();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private int auditCount(String action, String resourceId) {
        return jdbc.queryForObject("SELECT count(*) FROM agerp.log_sistema WHERE acao=? AND recurso_id=?",
                Integer.class, action, resourceId);
    }

    @Test
    void simultaneousConfirmationOfSameOrderIsIdempotentAndDebitsStockOnlyOnce() throws Exception {
        Fixture fixture = fixture(7);
        int orderId = createOrder(fixture, 2);
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> confirmAfterStart(orderId, start));
            var second = executor.submit(() -> confirmAfterStart(orderId, start));
            start.countDown();
            assertEquals("CONFIRMADO", first.get(40, TimeUnit.SECONDS));
            assertEquals("CONFIRMADO", second.get(40, TimeUnit.SECONDS));
        }

        assertEquals(5, estoques.findByIdProduto_Id(fixture.productId()).orElseThrow().getQuantidadeAtual());
        assertEquals(1, auditCount("ALTERACAO_STATUS_PEDIDO", String.valueOf(orderId)));
        assertEquals(1, auditCount("BAIXA_ESTOQUE_PEDIDO", String.valueOf(fixture.productId())));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM agerp.movimentacao_estoque "
                + "WHERE id_produto=? AND tipo='SAIDA'", Integer.class, fixture.productId()));
    }

    @Test
    void competingOrdersAgainstInsufficientSharedStockCommitOnlyOneDebitAndAudit() throws Exception {
        Fixture fixture = fixture(3);
        int firstOrder = createOrder(fixture, 2);
        int secondOrder = createOrder(fixture, 2);
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> attemptConfirm(firstOrder, start));
            var second = executor.submit(() -> attemptConfirm(secondOrder, start));
            start.countDown();
            boolean firstCommitted = first.get(40, TimeUnit.SECONDS);
            boolean secondCommitted = second.get(40, TimeUnit.SECONDS);
            assertNotEquals(firstCommitted, secondCommitted, "Exactly one order can consume the available stock");
        }

        assertEquals(1, estoques.findByIdProduto_Id(fixture.productId()).orElseThrow().getQuantidadeAtual());
        assertEquals(1, auditCount("BAIXA_ESTOQUE_PEDIDO", String.valueOf(fixture.productId())));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM agerp.log_sistema "
                + "WHERE acao='ALTERACAO_STATUS_PEDIDO' AND recurso_id IN (?,?)", Integer.class,
                String.valueOf(firstOrder), String.valueOf(secondOrder)));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM agerp.movimentacao_estoque "
                + "WHERE id_produto=? AND tipo='SAIDA'", Integer.class, fixture.productId()));
    }

    private String confirmAfterStart(int orderId, CountDownLatch start) throws InterruptedException {
        assertTrue(start.await(10, TimeUnit.SECONDS));
        authenticate();
        try { return pedidos.mudarStatus(orderId, "CONFIRMADO").getStatus(); }
        finally { SecurityContextHolder.clearContext(); }
    }

    private boolean attemptConfirm(int orderId, CountDownLatch start) throws InterruptedException {
        assertTrue(start.await(10, TimeUnit.SECONDS));
        authenticate();
        try {
            pedidos.mudarStatus(orderId, "CONFIRMADO");
            return true;
        } catch (IllegalArgumentException insufficientStock) {
            assertTrue(insufficientStock.getMessage().contains("Estoque insuficiente"));
            return false;
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
