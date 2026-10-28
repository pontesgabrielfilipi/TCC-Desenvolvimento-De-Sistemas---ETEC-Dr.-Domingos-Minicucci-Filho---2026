// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp;

import com.agerp.agerp.service.AdminService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@Transactional
class AdminServiceEstatisticasIntegrationTest {

    @Autowired
    private AdminService service;

    @Autowired
    private JdbcTemplate jdbc;

    private static final LocalDateTime INICIO = LocalDateTime.parse("2026-01-01T00:00:00");
    private static final LocalDateTime FIM = LocalDateTime.parse("2026-01-31T23:59:59");

    @BeforeEach
    void prepararCenarioControlado() {
        jdbc.execute("TRUNCATE TABLE agerp.perfil, agerp.cliente, agerp.produto RESTART IDENTITY CASCADE");

        jdbc.update("INSERT INTO agerp.perfil (id_perfil,nome) VALUES (1,'ADMIN'),(2,'OPERADOR')");
        jdbc.update("""
                INSERT INTO agerp.usuario
                    (id_usuario,nome,email,senha_hash,ativo,id_perfil,status_acesso)
                VALUES
                    (1,'Ana','ana@agerp.test','hash',true,1,'APROVADO'),
                    (2,'Bruno','bruno@agerp.test','hash',true,2,'PENDENTE'),
                    (3,'Carla','carla@agerp.test','hash',false,2,'BLOQUEADO')
                """);
        jdbc.update("""
                INSERT INTO agerp.cliente (id_cliente,tipo,nome_razao)
                VALUES (1,'PJ','Cliente Um'),(2,'PF','Cliente Dois')
                """);
        jdbc.update("""
                INSERT INTO agerp.produto (id_produto,nome,preco,ativo)
                VALUES (1,'Produto A',0.05,true),(2,'Produto B',10.00,true)
                """);
        jdbc.update("""
                INSERT INTO agerp.estoque (id_estoque,id_produto,quantidade_atual,quantidade_minima)
                VALUES (1,1,10,10),(2,2,7,5)
                """);

        pedido(1, 1, 1, INICIO, "ENTREGUE", "0.10");
        pedido(2, 1, 1, FIM, "CANCELADO", "99.99");
        pedido(3, 1, 2, LocalDateTime.parse("2026-02-10T12:00:00"), "PENDENTE", "0.20");
        pedido(4, 2, 1, LocalDateTime.parse("2026-03-10T12:00:00"), "EM_PREPARACAO", "10.00");

        item(1, 1, 1, 2, "0.05");
        item(2, 2, 1, 3, "0.05");
        item(3, 3, 2, 1, "0.20");
        item(4, 4, 2, 1, "10.00");

        movimentacao(1, 1, "SAIDA", 2, LocalDateTime.parse("2026-01-10T12:00:00"), 1);
        movimentacao(2, 1, "ENTRADA", 3, LocalDateTime.parse("2026-01-20T12:00:00"), 1);
        movimentacao(3, 2, "SAIDA", 1, LocalDateTime.parse("2026-03-10T12:00:00"), 2);
    }

    @Test
    void combinaTodosOsFiltrosIncluiLimitesEExcluiCanceladoDoFaturamento() {
        var resultado = estatisticas(
                List.of(1), List.of(1), List.of("ENTREGUE", "CANCELADO"), INICIO, FIM);

        assertEquals(2, resultado.pedidos().total());
        assertDecimal("0.10", resultado.pedidos().faturamento());
        assertDecimal("0.10", resultado.pedidos().ticketMedio());
        assertEquals(1, resultado.clientes().comPedidos());
        assertEquals(2, resultado.pedidos().distribuicaoStatus().size());
        assertEquals(1, resultado.usuarios().desempenho().conteudo().size());
        assertEquals(2, resultado.usuarios().desempenho().conteudo().getFirst().pedidos());
        assertDecimal("0.10", resultado.usuarios().desempenho().conteudo().getFirst().faturamento());
        assertEquals(1, resultado.usuarios().movimentacoes().conteudo().size());
        assertEquals(2, resultado.usuarios().movimentacoes().conteudo().getFirst().movimentacoes());
        assertEquals(2, resultado.usuarios().movimentacoes().conteudo().getFirst().quantidadeSaida());
        assertEquals(3, resultado.usuarios().movimentacoes().conteudo().getFirst().quantidadeEntrada());

        // Quantidade e valor dos itens respeitam os filtros; a regra de exclusão
        // de CANCELADO aplica-se especificamente ao faturamento de pedidos.
        assertEquals(5, resultado.produtos().quantidadeVendida());
        assertDecimal("0.25", resultado.produtos().valorVendido());

        // Cadastros e estoque são globais e não devem encolher com filtros de pedidos.
        assertEquals(3, resultado.usuarios().total());
        assertEquals(2, resultado.usuarios().ativos());
        assertEquals(1, resultado.usuarios().pendentes());
        assertEquals(1, resultado.usuarios().bloqueados());
        assertEquals(2, resultado.clientes().total());
        assertEquals(2, resultado.produtos().total());
        assertEquals(17, resultado.produtos().estoqueDisponivel());
        // O limite configurável é 15; ambos os estoques, 10 e 7, estão abaixo dele.
        assertEquals(2, resultado.produtos().estoqueBaixo());
        assertTrue(resultado.metadados().filtrosNaoAplicaveis().get("usuariosGlobais").contains("inicio"));
        assertTrue(resultado.filtrosDisponiveis().categoriasProduto().isEmpty());
        assertTrue(resultado.metadados().categoriaProduto().contains("Indispon"));
    }

    @Test
    void preservaPrecisaoDecimalAoSomarETirarMedia() {
        var resultado = estatisticas(
                List.of(1, 2), List.of(1), List.of("ENTREGUE", "PENDENTE"),
                INICIO, LocalDateTime.parse("2026-02-28T23:59:59"));

        assertEquals(2, resultado.pedidos().total());
        assertDecimal("0.30", resultado.pedidos().faturamento());
        assertDecimal("0.15", resultado.pedidos().ticketMedio());
        assertEquals(3, resultado.produtos().quantidadeVendida());
        assertDecimal("0.30", resultado.produtos().valorVendido());
    }

    @Test
    void intervaloSemPedidosRetornaZerosColecoesVaziasEMetricasGlobais() {
        var resultado = estatisticas(null, null, null,
                LocalDateTime.parse("2030-01-01T00:00:00"), LocalDateTime.parse("2030-01-31T23:59:59"));

        assertEquals(0, resultado.pedidos().total());
        assertDecimal("0", resultado.pedidos().faturamento());
        assertDecimal("0", resultado.pedidos().ticketMedio());
        assertEquals(0, resultado.clientes().comPedidos());
        assertEquals(0, resultado.produtos().quantidadeVendida());
        assertDecimal("0", resultado.produtos().valorVendido());
        assertTrue(resultado.pedidos().distribuicaoStatus().isEmpty());
        assertTrue(resultado.pedidos().evolucaoMensal().isEmpty());
        assertTrue(resultado.usuarios().desempenho().conteudo().isEmpty());
        assertTrue(resultado.usuarios().movimentacoes().conteudo().isEmpty());
        assertTrue(resultado.clientes().topFrequentes().conteudo().isEmpty());
        assertTrue(resultado.produtos().topVendidos().conteudo().isEmpty());
        assertEquals(3, resultado.usuarios().total());
        assertEquals(2, resultado.clientes().total());
        assertEquals(2, resultado.produtos().total());
    }

    @Test
    void rejeitaIntervaloInvertidoAntesDeConsultarAgregacoes() {
        var erro = assertThrows(IllegalArgumentException.class,
                () -> estatisticas(null, null, null, FIM, INICIO));

        assertTrue(erro.getMessage().contains("Data inicial"));
    }

    @Test
    void agrupaStatusEExibeEvolucaoPorCliente() {
        var resultado = estatisticas(null, null, null, null, null);

        assertEquals(4, resultado.pedidos().total());
        assertEquals(1, resultado.pedidos().pendentes());
        assertEquals(1, resultado.pedidos().emAndamento());
        assertEquals(1, resultado.pedidos().concluidos());
        assertEquals(1, resultado.pedidos().cancelados());
        assertEquals(3, resultado.clientes().evolucao().size());
        assertTrue(resultado.clientes().evolucao().stream()
                .anyMatch(item -> "2026-03".equals(item.periodo()) && item.id() == 2 && item.pedidos() == 1));
    }

    @Test
    void paginaTabelasExtensasDeFormaIndependente() {
        var resultado = service.estatisticas(
                null, null, null, null, null,
                1, 0, 1, 1, 1);

        assertEquals(2, resultado.produtos().topVendidos().totalElementos());
        assertEquals(1, resultado.produtos().topVendidos().pagina());
        assertEquals(1, resultado.produtos().topVendidos().conteudo().size());
        assertEquals(2, resultado.usuarios().desempenho().totalElementos());
        assertEquals(0, resultado.usuarios().desempenho().pagina());
        assertEquals(2, resultado.clientes().topFrequentes().totalElementos());
        assertEquals(1, resultado.clientes().topFrequentes().pagina());
        assertEquals(2, resultado.usuarios().movimentacoes().totalElementos());
        assertEquals(1, resultado.usuarios().movimentacoes().pagina());
    }

    private com.agerp.agerp.dto.AdminEstatisticasResponse estatisticas(
            List<Integer> usuarios,
            List<Integer> clientes,
            List<String> status,
            LocalDateTime inicio,
            LocalDateTime fim) {
        return service.estatisticas(usuarios, clientes, status, inicio, fim, 0, 0, 0, 0, 10);
    }

    private void pedido(int id, int cliente, int usuario, LocalDateTime data, String status, String valor) {
        jdbc.update("""
                INSERT INTO agerp.pedido
                    (id_pedido,id_cliente,id_usuario,data_pedido,status,valor_total)
                VALUES (?,?,?,?,?,?)
                """, id, cliente, usuario, Timestamp.valueOf(data), status, new BigDecimal(valor));
    }

    private void item(int id, int pedido, int produto, int quantidade, String preco) {
        jdbc.update("""
                INSERT INTO agerp.item_pedido
                    (id_item,id_pedido,id_produto,quantidade,preco_unitario)
                VALUES (?,?,?,?,?)
                """, id, pedido, produto, quantidade, new BigDecimal(preco));
    }

    private void movimentacao(int id, int produto, String tipo, int quantidade, LocalDateTime data, int usuario) {
        jdbc.update("""
                INSERT INTO agerp.movimentacao_estoque
                    (id_movimentacao,id_produto,tipo,quantidade,data_movimentacao,id_usuario)
                VALUES (?,?,?,?,?,?)
                """, id, produto, tipo, quantidade, Timestamp.valueOf(data), usuario);
    }

    private static void assertDecimal(String esperado, BigDecimal atual) {
        assertEquals(0, new BigDecimal(esperado).compareTo(atual),
                () -> "Esperado " + esperado + ", obtido " + atual);
    }
}
