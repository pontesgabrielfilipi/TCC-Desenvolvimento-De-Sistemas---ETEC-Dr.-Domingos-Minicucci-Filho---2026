package com.agerp.agerp;

import com.agerp.agerp.dto.ItemPedidoRequest;
import com.agerp.agerp.dto.PedidoCreateRequest;
import com.agerp.agerp.dto.PedidoUpdateRequest;
import com.agerp.agerp.dto.PedidoResponse;
import com.agerp.agerp.entity.*;
import com.agerp.agerp.repository.*;
import com.agerp.agerp.service.PedidoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
public class PedidoServiceTest {

    @Autowired
    private PedidoService pedidoService;

    @Autowired
    private PedidoRepository pedidoRepository;

    @Autowired
    private ClienteRepository clienteRepository;

    @Autowired
    private ProdutoRepository produtoRepository;

    @Autowired
    private EstoqueRepository estoqueRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private PerfilRepository perfilRepository;

    private Cliente cliente;
    private Produto produto1;
    private Produto produto2;
    private Estoque estoque1;
    private Estoque estoque2;

    @BeforeEach
    public void setup() {
        // Criar perfil
        Perfil perfil = new Perfil();
        perfil.setNome("OPERADOR");
        perfil = perfilRepository.save(perfil);

        // Criar usuario
        Usuario usuario = new Usuario();
        usuario.setNome("Teste");
        usuario.setEmail("teste@teste.com");
        usuario.setSenhaHash("hash");
        usuario.setIdPerfil(perfil);
        usuarioRepository.save(usuario);

        // Criar cliente
        cliente = new Cliente();
        cliente.setNomeRazao("Cliente Teste");
        cliente.setTipo("FISICA");
        cliente.setCpfCnpj("12345678900");
        cliente.setEmail("cliente@teste.com");
        cliente.setTelefone("11999999999");
        cliente = clienteRepository.save(cliente);

        // Criar produtos
        produto1 = new Produto();
        produto1.setNome("Produto 1");
        produto1.setPreco(BigDecimal.valueOf(100));
        produto1.setCusto(BigDecimal.valueOf(50));
        produto1.setAtivo(true);
        produto1 = produtoRepository.save(produto1);

        produto2 = new Produto();
        produto2.setNome("Produto 2");
        produto2.setPreco(BigDecimal.valueOf(200));
        produto2.setCusto(BigDecimal.valueOf(100));
        produto2.setAtivo(true);
        produto2 = produtoRepository.save(produto2);

        // Criar estoques
        estoque1 = new Estoque();
        estoque1.setIdProduto(produto1);
        estoque1.setQuantidadeAtual(10);
        estoque1.setQuantidadeMinima(2);
        estoque1 = estoqueRepository.save(estoque1);

        estoque2 = new Estoque();
        estoque2.setIdProduto(produto2);
        estoque2.setQuantidadeAtual(5);
        estoque2.setQuantidadeMinima(1);
        estoque2 = estoqueRepository.save(estoque2);
    }

    // ====================== TESTES DE CRIAÇÃO ======================

    @Test
    public void testCriarPedidoComSucesso() {
        PedidoCreateRequest request = new PedidoCreateRequest();
        request.setIdCliente(cliente.getId());
        request.setItens(List.of(
                new ItemPedidoRequest(produto1.getId(), 2),
                new ItemPedidoRequest(produto2.getId(), 1)
        ));

        PedidoResponse response = pedidoService.criar(request);

        assertNotNull(response.getId());
        assertEquals("PENDENTE", response.getStatus());
        assertEquals(BigDecimal.valueOf(400), response.getValorTotal()); // 2*100 + 1*200
        assertEquals(2, response.getItens().size());
    }

    @Test
    public void testCriarPedidoComClienteInexistente() {
        PedidoCreateRequest request = new PedidoCreateRequest();
        request.setIdCliente(9999);
        request.setItens(List.of(new ItemPedidoRequest(produto1.getId(), 1)));

        assertThrows(IllegalArgumentException.class, () -> pedidoService.criar(request));
    }

    @Test
    public void testCriarPedidoComProdutoInexistente() {
        PedidoCreateRequest request = new PedidoCreateRequest();
        request.setIdCliente(cliente.getId());
        request.setItens(List.of(new ItemPedidoRequest(9999, 1)));

        assertThrows(IllegalArgumentException.class, () -> pedidoService.criar(request));
    }

    @Test
    public void testCriarPedidoComProdutoInativo() {
        produto1.setAtivo(false);
        produtoRepository.save(produto1);

        PedidoCreateRequest request = new PedidoCreateRequest();
        request.setIdCliente(cliente.getId());
        request.setItens(List.of(new ItemPedidoRequest(produto1.getId(), 1)));

        assertThrows(IllegalArgumentException.class, () -> pedidoService.criar(request));
    }

    @Test
    public void testCriarPedidoComEstoqueInsuficiente() {
        PedidoCreateRequest request = new PedidoCreateRequest();
        request.setIdCliente(cliente.getId());
        request.setItens(List.of(new ItemPedidoRequest(produto1.getId(), 20))); // Tem apenas 10

        assertThrows(IllegalArgumentException.class, () -> pedidoService.criar(request));
    }

    @Test
    public void testCriarPedidoComProdutoDuplicado() {
        PedidoCreateRequest request = new PedidoCreateRequest();
        request.setIdCliente(cliente.getId());
        request.setItens(List.of(
                new ItemPedidoRequest(produto1.getId(), 1),
                new ItemPedidoRequest(produto1.getId(), 2)
        ));

        assertThrows(IllegalArgumentException.class, () -> pedidoService.criar(request));
    }

    @Test
    public void testCriarPedidoSemItens() {
        PedidoCreateRequest request = new PedidoCreateRequest();
        request.setIdCliente(cliente.getId());
        request.setItens(List.of());

        assertThrows(IllegalArgumentException.class, () -> pedidoService.criar(request));
    }

    // ====================== TESTES DE LEITURA ======================

    @Test
    public void testListarTodosPedidos() {
        pedidoService.criar(new PedidoCreateRequest(
                cliente.getId(),
                List.of(new ItemPedidoRequest(produto1.getId(), 1)),
                null
        ));

        List<PedidoResponse> pedidos = pedidoService.listarTodos();
        assertFalse(pedidos.isEmpty());
        assertTrue(pedidos.size() >= 1);
    }

    @Test
    public void testBuscarPedidoPorId() {
        PedidoResponse criado = pedidoService.criar(new PedidoCreateRequest(
                cliente.getId(),
                List.of(new ItemPedidoRequest(produto1.getId(), 1)),
                null
        ));

        PedidoResponse buscado = pedidoService.buscarPorId(criado.getId());
        assertEquals(criado.getId(), buscado.getId());
    }

    @Test
    public void testBuscarPedidoInexistente() {
        assertThrows(IllegalArgumentException.class, () -> pedidoService.buscarPorId(9999));
    }

    // ====================== TESTES DE STATUS ======================

    @Test
    public void testMudarStatusComTransicaoValida() {
        PedidoResponse criado = pedidoService.criar(new PedidoCreateRequest(
                cliente.getId(),
                List.of(new ItemPedidoRequest(produto1.getId(), 1)),
                null
        ));

        PedidoResponse atualizado = pedidoService.mudarStatus(criado.getId(), "CONFIRMADO");
        assertEquals("CONFIRMADO", atualizado.getStatus());
    }

    @Test
    public void testMudarStatusComTransicaoInvalida() {
        PedidoResponse criado = pedidoService.criar(new PedidoCreateRequest(
                cliente.getId(),
                List.of(new ItemPedidoRequest(produto1.getId(), 1)),
                null
        ));

        // PENDENTE não pode ir direto para ENTREGUE
        assertThrows(IllegalArgumentException.class, 
                () -> pedidoService.mudarStatus(criado.getId(), "ENTREGUE"));
    }

    @Test
    public void testMudarStatusInvalido() {
        PedidoResponse criado = pedidoService.criar(new PedidoCreateRequest(
                cliente.getId(),
                List.of(new ItemPedidoRequest(produto1.getId(), 1)),
                null
        ));

        assertThrows(IllegalArgumentException.class, 
                () -> pedidoService.mudarStatus(criado.getId(), "STATUS_INEXISTENTE"));
    }

    // ====================== TESTES DE CANCELAMENTO ======================

    @Test
    public void testCancelarPedido() {
        PedidoResponse criado = pedidoService.criar(new PedidoCreateRequest(
                cliente.getId(),
                List.of(new ItemPedidoRequest(produto1.getId(), 1)),
                null
        ));

        PedidoResponse cancelado = pedidoService.cancelar(criado.getId());
        assertEquals("CANCELADO", cancelado.getStatus());
    }

    @Test
    public void testCancelarPedidoJaEntregue() {
        PedidoResponse criado = pedidoService.criar(new PedidoCreateRequest(
                cliente.getId(),
                List.of(new ItemPedidoRequest(produto1.getId(), 1)),
                null
        ));

        // Ir até ENTREGUE
        pedidoService.mudarStatus(criado.getId(), "CONFIRMADO");
        pedidoService.mudarStatus(criado.getId(), "EM_PREPARACAO");
        pedidoService.mudarStatus(criado.getId(), "PRONTO");
        pedidoService.mudarStatus(criado.getId(), "ENTREGUE");

        // Tentar cancelar
        assertThrows(IllegalArgumentException.class, 
                () -> pedidoService.cancelar(criado.getId()));
    }

    // ====================== TESTES DE ATUALIZAÇÃO ======================

    @Test
    public void testAtualizarPedidoPendente() {
        PedidoResponse criado = pedidoService.criar(new PedidoCreateRequest(
                cliente.getId(),
                List.of(new ItemPedidoRequest(produto1.getId(), 1)),
                null
        ));

        PedidoUpdateRequest atualizacao = new PedidoUpdateRequest(
                cliente.getId(),
                List.of(new ItemPedidoRequest(produto2.getId(), 2)),
                null
        );

        PedidoResponse atualizado = pedidoService.atualizar(criado.getId(), atualizacao);
        assertEquals(BigDecimal.valueOf(400), atualizado.getValorTotal());
        assertEquals(1, atualizado.getItens().size());
    }

    @Test
    public void testAtualizarPedidoNaoPendente() {
        PedidoResponse criado = pedidoService.criar(new PedidoCreateRequest(
                cliente.getId(),
                List.of(new ItemPedidoRequest(produto1.getId(), 1)),
                null
        ));

        pedidoService.mudarStatus(criado.getId(), "CONFIRMADO");

        PedidoUpdateRequest atualizacao = new PedidoUpdateRequest(
                cliente.getId(),
                List.of(new ItemPedidoRequest(produto2.getId(), 1)),
                null
        );

        assertThrows(IllegalArgumentException.class, 
                () -> pedidoService.atualizar(criado.getId(), atualizacao));
    }

    // ====================== TESTES DE CÁLCULO ======================

    @Test
    public void testCálculoTotalPedido() {
        PedidoResponse response = pedidoService.criar(new PedidoCreateRequest(
                cliente.getId(),
                List.of(
                        new ItemPedidoRequest(produto1.getId(), 3),  // 3 * 100 = 300
                        new ItemPedidoRequest(produto2.getId(), 2)   // 2 * 200 = 400
                ),
                null
        ));

        // Total deve ser 700
        assertEquals(BigDecimal.valueOf(700), response.getValorTotal());
        
        // Itens devem ter subtotais corretos
        assertEquals(BigDecimal.valueOf(300), response.getItens().get(0).getSubtotal());
        assertEquals(BigDecimal.valueOf(400), response.getItens().get(1).getSubtotal());
    }
}
