// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp;

import com.agerp.agerp.dto.ConfiguracaoSistemaRequest;
import com.agerp.agerp.repository.UsuarioRepository;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.service.ConfiguracaoSistemaService;
import com.agerp.agerp.service.EstoqueBaixoService;
import com.agerp.agerp.service.ProdutoService;
import com.agerp.agerp.service.DashboardService;
import com.agerp.agerp.service.AdminService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.cache.CacheManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "agerp.seed.enabled=true")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ConfiguracaoSistemaIntegrationTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private ConfiguracaoSistemaService configuracoes;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private MockMvc mvc;
    @Autowired private EstoqueBaixoService estoqueBaixo;
    @Autowired private ProdutoService produtos;
    @Autowired private DashboardService dashboard;
    @Autowired private AdminService adminService;
    @Autowired private CacheManager caches;

    @AfterEach
    void limparCachesDeTestesTransacionais() {
        for (var cacheNome : List.of("dashboardRelatorio", "dashboardEstatisticas", "adminEstatisticas",
                "produtosAtivos", "produtosTodos", "produtoPorId")) {
            var cache = caches.getCache(cacheNome);
            if (cache != null) cache.clear();
        }
    }

    private int cadastrarEstoque(String nome, Integer quantidade, Integer minimoIndividual) {
        Integer id = jdbc.queryForObject("INSERT INTO agerp.produto (nome, preco) VALUES (?, 10) RETURNING id_produto",
                Integer.class, nome);
        jdbc.update("INSERT INTO agerp.estoque (id_produto, quantidade_atual, quantidade_minima) VALUES (?, ?, ?)",
                id, quantidade, minimoIndividual);
        return id;
    }

    @Test
    void alternanciaRefleteEmProdutosDashboardAdministracaoEExportacaoSemPerderLimites() throws Exception {
        // Isola os dados antigos e verifica estritamente os seis casos deste teste.
        jdbc.update("UPDATE agerp.estoque SET quantidade_atual=1000000");
        int abaixo = cadastrarEstoque("Teste baixo A", 4, 5);
        int igual = cadastrarEstoque("Teste baixo B", 5, 5);
        int acima = cadastrarEstoque("Teste baixo C", 6, 5);
        int legado = cadastrarEstoque("Teste baixo D", 9, null);
        int zero = cadastrarEstoque("Teste baixo E", 0, 0);
        cadastrarEstoque("Teste baixo F", null, 20);

        assertEquals(5, estoqueBaixo.listar().size());
        assertEquals(15, produtos.buscarPorId(abaixo).getMinimoAplicado());
        assertEquals(5, dashboard.gerarRelatorioCompleto().getProdutosEstoqueBaixo());
        assertEquals(5, adminService.estatisticas(null, null, null, null, null,
                0, 0, 0, 0, 10).produtos().estoqueBaixo());
        mvc.perform(get("/api/dashboard/estoque-baixo")
                        .with(user("consultor").authorities(new SimpleGrantedAuthority("PAGE_DASHBOARD"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(5));

        var usuarioAdmin = usuarios.findAll().stream()
                .filter(u -> "ADMIN".equalsIgnoreCase(u.getIdPerfil().getNome())).findFirst().orElseThrow();
        var inicial = configuracoes.consultar();
        configuracoes.atualizar(new ConfiguracaoSistemaRequest(inicial.nomeEmpresa(), 15,
                false, inicial.exibirAlertasEstoque(), inicial.timeoutIaMs(), inicial.versao()),
                usuarioAdmin, "127.0.0.1");
        // @Transactional reverte o teste, portanto afterCommit não roda aqui. A invalidação
        // pós-commit é simulada para verificar os consumidores com cache.
        limparCachesDeTestesTransacionais();

        assertEquals(2, estoqueBaixo.listar().size());
        assertEquals(5, produtos.buscarPorId(abaixo).getMinimoAplicado());
        assertTrue(produtos.buscarPorId(abaixo).getEstoqueBaixo());
        assertFalse(produtos.buscarPorId(igual).getEstoqueBaixo());
        assertFalse(produtos.buscarPorId(acima).getEstoqueBaixo());
        assertFalse(produtos.buscarPorId(zero).getEstoqueBaixo());
        assertEquals(10, produtos.buscarPorId(legado).getMinimoAplicado());
        assertEquals(2, dashboard.gerarRelatorioCompleto().getProdutosEstoqueBaixo());
        assertEquals(2, adminService.estatisticas(null, null, null, null, null,
                0, 0, 0, 0, 10).produtos().estoqueBaixo());
        mvc.perform(get("/api/dashboard/estoque-baixo")
                        .with(user("consultor").authorities(new SimpleGrantedAuthority("PAGE_DASHBOARD"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));

        var individual = configuracoes.consultar();
        configuracoes.atualizar(new ConfiguracaoSistemaRequest(individual.nomeEmpresa(), 15,
                true, individual.exibirAlertasEstoque(), individual.timeoutIaMs(), individual.versao()),
                usuarioAdmin, "127.0.0.1");
        limparCachesDeTestesTransacionais();
        assertEquals(5, estoqueBaixo.listar().size());
        assertEquals(5, jdbc.queryForObject("SELECT quantidade_minima FROM agerp.estoque WHERE id_produto=?",
                Integer.class, abaixo));
        assertNull(jdbc.queryForObject("SELECT quantidade_minima FROM agerp.estoque WHERE id_produto=?",
                Integer.class, legado));
        assertEquals(5, produtos.buscarPorId(igual).getQuantidadeMinima());
    }

    @Test
    void endpointsRejeitamLimitesNegativosEFracionarios() throws Exception {
        var administrador = usuarios.findAll().stream()
                .filter(u -> "ADMIN".equalsIgnoreCase(u.getIdPerfil().getNome())).findFirst().orElseThrow();
        var autenticado = user(new CustomUserDetails(administrador,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"),
                        new SimpleGrantedAuthority("PAGE_PRODUTOS"))));
        for (String limite : List.of("-1", "1.5")) {
            mvc.perform(put("/api/admin/configuracoes").with(csrf()).with(autenticado)
                            .contentType("application/json").content("""
                                    {"nomeEmpresa":"AGERP","limiteEstoqueBaixo":%s,"usarEstoqueMinimoGeral":true,
                                     "exibirAlertasEstoque":true,"timeoutIaMs":2000,"versao":0}
                                    """.formatted(limite))).andExpect(status().isBadRequest());
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/produtos")
                            .with(csrf()).with(autenticado).contentType("application/json").content("""
                                    {"nome":"Produto limite invalido","preco":10,"custo":0,
                                     "quantidadeInicial":0,"quantidadeMinima":%s}
                                    """.formatted(limite))).andExpect(status().isBadRequest());
        }
    }

    @Test
    void flywayDisponibilizaDefaultsPersistidos() {
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM agerp.configuracao_sistema", Integer.class));
        var config = configuracoes.consultar();
        assertEquals("AGERP", config.nomeEmpresa());
        assertEquals(15, config.limiteEstoqueBaixo());
        assertTrue(config.usarEstoqueMinimoGeral());
        assertTrue(config.exibirAlertasEstoque());
        assertEquals(2000, config.timeoutIaMs());
    }

    @Test
    void leituraDeConfiguracoesAfetaServicoSemReiniciar() {
        jdbc.update("UPDATE agerp.configuracao_sistema SET limite_estoque_baixo=9, timeout_ia_ms=3200 WHERE id=1");
        assertEquals(9, configuracoes.limiteEstoqueBaixo());
        assertEquals(3200, configuracoes.timeoutIaMs());
    }

    @Test
    void alteracaoTransacionalPersisteVersaoEAuditoriaSemExporSegredos() {
        var admin = usuarios.findAll().stream()
                .filter(u -> "ADMIN".equalsIgnoreCase(u.getIdPerfil().getNome()))
                .findFirst().orElseThrow();
        var anterior = configuracoes.consultar();

        var resultado = configuracoes.atualizar(new ConfiguracaoSistemaRequest(
                "Empresa Teste", 8, false, false, 3500, anterior.versao()), admin, "127.0.0.1");

        assertEquals(anterior.versao() + 1, resultado.versao());
        assertEquals("Empresa Teste", jdbc.queryForObject(
                "SELECT nome_empresa FROM agerp.configuracao_sistema WHERE id=1", String.class));
        assertEquals(8, configuracoes.limiteEstoqueBaixo());
        assertFalse(configuracoes.regraEstoque().usarGeral());
        assertFalse(jdbc.queryForObject("SELECT usar_estoque_minimo_geral FROM agerp.configuracao_sistema WHERE id=1", Boolean.class));
        assertEquals(3500, configuracoes.timeoutIaMs());
        assertEquals(1, jdbc.queryForObject("""
                SELECT COUNT(*) FROM agerp.log_sistema
                WHERE acao='ALTERACAO_CONFIGURACOES' AND entidade='CONFIGURACAO'
                  AND recurso_id='1' AND usuario_email=? AND resultado='SUCESSO'
                """, Integer.class, admin.getEmail()));
    }

    @Test
    void operadorNaoPodeConsultarConfiguracoesAdministrativas() throws Exception {
        mvc.perform(get("/api/admin/configuracoes").with(user("operador").roles("OPERADOR")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/configuracoes").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nomeEmpresa").value("AGERP"));
    }

    @Test
    void configuracaoPublicaSoExpõePreferenciasDeAparencia() throws Exception {
        mvc.perform(get("/api/configuracoes/aparencia").with(user("operador").roles("OPERADOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nomeEmpresa").value("AGERP"))
                .andExpect(jsonPath("$.timeoutIaMs").doesNotExist())
                .andExpect(jsonPath("$.versao").doesNotExist());
    }

    @Test
    void putInvalidoRetorna400EOperadorRecebe403() throws Exception {
        String corpoInvalido = """
                {"nomeEmpresa":"  ","limiteEstoqueBaixo":0,"exibirAlertasEstoque":true,"timeoutIaMs":100,"versao":0}
                """;
        mvc.perform(put("/api/admin/configuracoes")
                        .with(csrf()).with(user("admin").roles("ADMIN"))
                        .contentType("application/json").content(corpoInvalido))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/admin/configuracoes")
                        .with(user("operador").roles("OPERADOR"))
                        .contentType("application/json").content(corpoInvalido))
                .andExpect(status().isForbidden());
    }

    @Test
    void versaoObsoletaRetorna409NoEndpointSemAlterarRegistro() throws Exception {
        var admin = usuarios.findAll().stream()
                .filter(u -> "ADMIN".equalsIgnoreCase(u.getIdPerfil().getNome()))
                .findFirst().orElseThrow();
        var config = configuracoes.consultar();
        String corpo = """
                {"nomeEmpresa":"Nao deve salvar","limiteEstoqueBaixo":9,
                 "usarEstoqueMinimoGeral":true,"exibirAlertasEstoque":false,"timeoutIaMs":3000,"versao":%d}
                """.formatted(config.versao() + 1);

        mvc.perform(put("/api/admin/configuracoes")
                        .with(csrf()).with(user(new CustomUserDetails(admin,
                                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")))))
                        .contentType("application/json").content(corpo))
                .andExpect(status().isConflict());
        assertEquals(config.nomeEmpresa(), jdbc.queryForObject(
                "SELECT nome_empresa FROM agerp.configuracao_sistema WHERE id=1", String.class));
    }
}
