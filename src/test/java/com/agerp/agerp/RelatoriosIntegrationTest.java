package com.agerp.agerp;

import com.agerp.agerp.service.RelatorioAdminService;
import com.agerp.agerp.service.SessaoAutenticacaoService;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.security.CustomUserDetailsService;
import com.agerp.agerp.security.jwt.JwtTokenProvider;
import jakarta.servlet.http.Cookie;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.usermodel.CellType;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.flyway.placeholders.auditAppRole=test")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Import({TestcontainersConfiguration.class, RelatoriosIntegrationTest.MockMvcAsyncConfiguration.class})
@Transactional
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class RelatoriosIntegrationTest {
    /** Evita escrita concorrente nos cabeçalhos não thread-safe do MockHttpServletResponse.
     * O servidor real continua com seu executor original. */
    @TestConfiguration
    static class MockMvcAsyncConfiguration implements WebMvcConfigurer {
        @Override
        public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
            ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
            executor.setThreadNamePrefix("xlsx-test-");
            executor.setCorePoolSize(2);
            executor.setMaxPoolSize(4);
            executor.setQueueCapacity(64);
            executor.setTaskDecorator(task -> () -> {
                try {
                    Thread.sleep(100);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    return;
                }
                task.run();
            });
            executor.initialize();
            configurer.setTaskExecutor(executor);
        }
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired RelatorioAdminService service;
    @Autowired MockMvc mvc;
    @Autowired CustomUserDetailsService usuarios;
    @Autowired JwtTokenProvider tokens;
    @Autowired SessaoAutenticacaoService sessoes;

    Stream<String> idsDoCatalogo() {
        return service.catalogo().stream().map(RelatorioAdminService.Relatorio::id);
    }

    @ParameterizedTest(name = "XLSX real e cabecalhos de {0}")
    @MethodSource("idsDoCatalogo")
    void descritorProduzPlanilhaComCabecalhosTiposEValoresSemFormulas(String id) throws Exception {
        var relatorio = service.obter(id);
        var saida = new ByteArrayOutputStream();
        var semFiltros = new RelatorioAdminService.Filtros(null, null, null, null, null, null);
        int linhas = service.exportarComContagem(relatorio, semFiltros, saida, null);
        try (var workbook = WorkbookFactory.create(new ByteArrayInputStream(saida.toByteArray()))) {
            var dados = workbook.getSheet("Dados 1");
            var resumo = workbook.getSheet("Informações");
            assertNotNull(dados, id);
            assertNotNull(resumo, id);
            assertEquals(linhas, (int) resumo.getRow(12).getCell(1).getNumericCellValue(), id);
            assertEquals(relatorio.colunas().size(), dados.getRow(0).getPhysicalNumberOfCells(), id);
            for (int coluna = 0; coluna < relatorio.colunas().size(); coluna++) {
                assertEquals(relatorio.colunas().get(coluna).titulo(),
                        dados.getRow(0).getCell(coluna).getStringCellValue(), id);
            }
            for (var sheet : workbook) {
                for (var row : sheet) {
                    for (var cell : row) {
                        assertNotEquals(CellType.FORMULA, cell.getCellType(), id + ":" + sheet.getSheetName());
                    }
                }
            }
            if (id.equals("clientes_tipo")) {
                assertEquals(2, linhas, "A fixture tem exatamente PF e PJ");
            }
            if (id.equals("vendas_periodo")) {
                assertTrue(linhas >= 2, "A fixture possui pedidos entregue e pendente");
            }
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void downloadHttpAssincronoEntregaPlanilhaCompletaParaAdmin() throws Exception {
        try (var livro = baixarPlanilha("clientes_tipo", cookieDe("operador@local.test"), Map.of())) {
            assertNotNull(livro.getSheet("Dados 1"));
            assertNotNull(livro.getSheet("Totais"));
            assertTrue(livro.getSheet("Dados 1").getPhysicalNumberOfRows() > 1);
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void exportacoesGeramEventosCorrelacionadosSemAfirmarDownloadSalvo() throws Exception {
        Cookie cookie = cookieDe("operador@local.test");
        MvcResult primeira = mvc.perform(get("/api/admin/relatorios/clientes_tipo/xlsx").cookie(cookie))
                .andExpect(request().asyncStarted()).andReturn();
        String exportId = primeira.getResponse().getHeader("X-Export-ID");
        assertNotNull(exportId);
        primeira.getAsyncResult(30_000);
        MvcResult resposta = mvc.perform(asyncDispatch(primeira)).andExpect(status().isOk()).andReturn();
        try (var livro = WorkbookFactory.create(new ByteArrayInputStream(resposta.getResponse().getContentAsByteArray()))) {
            assertNotNull(livro.getSheet("Dados 1"));
        }
        var eventos = jdbc.queryForList("SELECT acao, resultado, request_id, session_ref, changes_json "
                + "FROM agerp.log_sistema WHERE entidade='RELATORIO' AND recurso_id=? ORDER BY id_log", exportId);
        assertEquals(3, eventos.size());
        assertEquals("EXPORTACAO_SOLICITADA", eventos.get(0).get("acao"));
        assertEquals("EXPORTACAO_GERADA", eventos.get(1).get("acao"));
        assertEquals("EXPORTACAO_TRANSMISSAO_ENCERRADA", eventos.get(2).get("acao"));
        assertEquals("OBSERVADO", eventos.get(2).get("resultado"));
        assertNotNull(eventos.get(0).get("request_id"));
        assertNotNull(eventos.get(0).get("session_ref"));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void auditoriaDeExportacoesCongelaCorteAntesDeRegistrarSeuProprioEvento() throws Exception {
        Cookie cookie = cookieDe("operador@local.test");
        try (var ignorado = baixarPlanilha("clientes_tipo", cookie, Map.of())) {
            // A exportação anterior gera SOLICITADA, GERADA e TRANSMISSAO_ENCERRADA.
        }
        MvcResult pendente = mvc.perform(get("/api/admin/relatorios/auditoria_exportacoes/xlsx").cookie(cookie))
                .andExpect(request().asyncStarted()).andReturn();
        String novoExportId = pendente.getResponse().getHeader("X-Export-ID");
        assertNotNull(novoExportId);
        pendente.getAsyncResult(30_000);
        MvcResult resposta = mvc.perform(asyncDispatch(pendente)).andExpect(status().isOk()).andReturn();
        try (var livro = WorkbookFactory.create(new ByteArrayInputStream(resposta.getResponse().getContentAsByteArray()))) {
            var dados = livro.getSheet("Dados 1");
            assertEquals(3, dados.getLastRowNum(), "A exportacao de auditoria deve listar so os eventos anteriores");
            for (int linha = 1; linha <= dados.getLastRowNum(); linha++) {
                assertNotEquals(novoExportId, dados.getRow(linha).getCell(4).getStringCellValue(),
                        "A exportacao nao pode incluir seus proprios eventos");
            }
        }
        assertEquals(3, jdbc.queryForObject(
                "SELECT COUNT(*) FROM agerp.log_sistema WHERE entidade='RELATORIO' AND recurso_id=?",
                Integer.class, novoExportId));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void todosOsRelatoriosDoCatalogoExportamComESemFiltrosPeloHttp() throws Exception {
        Cookie cookie = cookieDe("operador@local.test");
        int exportacoes = 0;
        for (var relatorio : service.catalogo()) {
            try (var livro = baixarPlanilha(relatorio.id(), cookie, Map.of())) {
                assertEquals(relatorio.colunas().size(), livro.getSheet("Dados 1").getRow(0).getLastCellNum(), relatorio.id());
            }
            exportacoes++;
            Map<String, String> filtros = new LinkedHashMap<>();
            for (String filtro : relatorio.filtros()) {
                filtros.put(filtro, switch (filtro) {
                    case "inicio" -> "2026-01-01";
                    case "fim" -> "2026-02-28";
                    case "clienteId", "produtoId", "usuarioId" -> "1";
                    case "status" -> "ENTREGUE";
                    default -> throw new IllegalStateException("Filtro não testado: " + filtro);
                });
            }
            if (!filtros.isEmpty()) {
                try (var livro = baixarPlanilha(relatorio.id(), cookie, filtros)) {
                    assertNotNull(livro.getSheet("Informações"), relatorio.id());
                }
                exportacoes++;
            }
        }
        assertTrue(exportacoes >= service.catalogo().size());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void planilhaSemResultadosPossuiMensagemEContagemZero() throws Exception {
        try (var livro = baixarPlanilha("clientes_cadastro", cookieDe("operador@local.test"),
                Map.of("inicio", "2040-01-01", "fim", "2040-01-31"))) {
            assertEquals(0, livro.getSheet("Informações").getRow(12).getCell(1).getNumericCellValue());
            assertTrue(livro.getSheet("Dados 1").getRow(1).getCell(0).getStringCellValue()
                    .contains("Nenhum registro"));
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void usuarioSemAdminNaoIniciaExportacaoNemComJwtValido() throws Exception {
        jdbc.update("INSERT INTO agerp.perfil (id_perfil,nome,nivel_autoridade,protegido) VALUES (2,'OPERADOR',10,false)");
        jdbc.update("INSERT INTO agerp.usuario (id_usuario,nome,email,senha_hash,ativo,id_perfil,status_acesso) "
                + "VALUES (2,'Sem Admin','semadmin@local.test','hash',true,2,'APROVADO')");
        Cookie cookie = cookieDe("semadmin@local.test");
        mvc.perform(get("/api/admin/relatorios").cookie(cookie))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/relatorios/vendas_periodo/xlsx").cookie(cookie))
                .andExpect(status().isForbidden());
    }

    private Cookie cookieDe(String email) {
        CustomUserDetails detalhes = (CustomUserDetails) usuarios.loadUserByUsername(email);
        var autenticacao = new UsernamePasswordAuthenticationToken(detalhes, null, detalhes.getAuthorities());
        var sessao = sessoes.criar(detalhes.getUsuario(), null, 86_400_000);
        return new Cookie("jwtToken", tokens.generateToken(autenticacao, sessao.getId()));
    }

    private org.apache.poi.ss.usermodel.Workbook baixarPlanilha(String id, Cookie cookie, Map<String, String> filtros)
            throws Exception {
        MockHttpServletRequestBuilder requisicao = get("/api/admin/relatorios/" + id + "/xlsx").cookie(cookie);
        filtros.forEach(requisicao::param);
        MvcResult pendente = mvc.perform(requisicao)
                .andExpect(request().asyncStarted())
                .andReturn();

        // Conclui o callback antes do redispatch: headers do MockMvc não são thread-safe.
        pendente.getAsyncResult(30_000);
        MvcResult resposta = mvc.perform(asyncDispatch(pendente))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString(".xlsx")))
                .andReturn();
        byte[] bytes = resposta.getResponse().getContentAsByteArray();
        assertTrue(bytes.length > 100, "Download truncado ou vazio: " + id);
        assertEquals('P', bytes[0]);
        assertEquals('K', bytes[1]);
        var livro = WorkbookFactory.create(new ByteArrayInputStream(bytes));
        assertNotNull(livro.getSheet("Informações"), id);
        assertNotNull(livro.getSheet("Dados 1"), id);
        assertNotNull(livro.getSheet("Totais"), id);
        return livro;
    }

    @BeforeEach
    void dadosDeTeste() {
        jdbc.execute("TRUNCATE TABLE agerp.perfil, agerp.cliente, agerp.produto RESTART IDENTITY CASCADE");
        jdbc.update("INSERT INTO agerp.perfil (id_perfil,nome,nivel_autoridade,protegido) VALUES (1,'ADMIN',100,true)");
        jdbc.update("INSERT INTO agerp.perfil_pagina(id_perfil,pagina) VALUES (1,'ADMIN'),(1,'PEDIDOS')");
        jdbc.update("INSERT INTO agerp.usuario (id_usuario,nome,email,senha_hash,ativo,id_perfil,status_acesso) VALUES (1,'Operador','operador@local.test','hash',true,1,'APROVADO')");
        jdbc.update("INSERT INTO agerp.cliente (id_cliente,tipo,nome_razao,cpf_cnpj) VALUES (1,'PF','Cliente Um','00123456789'),(2,'PJ','Cliente Dois','00123456000100')");
        jdbc.update("INSERT INTO agerp.produto (id_produto,nome,preco,ativo) VALUES (1,'Produto A',10.00,true),(2,'Produto B',5.00,true)");
        jdbc.update("INSERT INTO agerp.estoque (id_produto,quantidade_atual,quantidade_minima) VALUES (1,5,10),(2,30,10)");
        jdbc.update("INSERT INTO agerp.movimentacao_estoque (id_produto,tipo,quantidade,data_movimentacao,id_usuario) VALUES (1,'ENTRADA',5,'2026-01-02 10:00:00',1)");
        jdbc.update("INSERT INTO agerp.pedido (id_pedido,id_cliente,data_pedido,status,valor_total,id_usuario) VALUES "
                + "(1,1,'2026-01-01 09:00:00','ENTREGUE',20.00,1),"
                + "(2,1,'2026-01-02 09:00:00','CANCELADO',90.00,1),"
                + "(3,2,'2026-02-01 09:00:00','PENDENTE',5.00,1)");
        jdbc.update("INSERT INTO agerp.item_pedido (id_pedido,id_produto,quantidade,preco_unitario) VALUES "
                + "(1,1,2,10.00),(2,1,9,10.00),(3,2,1,5.00)");
        jdbc.update("INSERT INTO agerp.entrega (id_pedido,status,data_saida) VALUES (1,'ENTREGUE','2026-01-01 10:00:00')");
        jdbc.update("INSERT INTO agerp.log_sistema (id_usuario,acao,entidade,data_hora,usuario_nome,resultado) VALUES "
                + "(1,'CRIAR','PEDIDO','2026-01-01 09:00:00','Operador','SUCESSO')");
    }

    @Test
    void todasConsultasDoCatalogoRodamNoPostgresRealComTiposEColunasValidos() {
        var filtrosCombinados = new RelatorioAdminService.Filtros(
                LocalDate.of(2026,1,1), LocalDate.of(2026,1,31), 1, 1, 1, "ENTREGUE");
        for (var relatorio : service.catalogo()) {
            for (var filtros : new RelatorioAdminService.Filtros[] {
                    new RelatorioAdminService.Filtros(null,null,null,null,null,null), filtrosCombinados}) {
                var consulta = service.consulta(relatorio, filtros);
                assertDoesNotThrow(() -> {
                    jdbc.query(consulta.sql(), ps -> {
                        for (int i = 0; i < consulta.parametros().size(); i++) ps.setObject(i + 1, consulta.parametros().get(i));
                    }, rs -> {
                        assertEquals(relatorio.colunas().size(), rs.getMetaData().getColumnCount(), relatorio.id());
                        while (rs.next()) { /* Consome linhas para detectar erros de SQL e agregação. */ }
                        return null;
                    });
                }, "SQL inválido no relatório: " + relatorio.id() + " / filtros=" + filtros);
            }
        }
    }

    @Test
    void filtroDatasIncluiDiaFinalEFaturamentoIgnoraCancelados() throws Exception {
        var filtro = new RelatorioAdminService.Filtros(LocalDate.of(2026,1,1),
                LocalDate.of(2026,1,31),1,null,1,null);
        var consulta = service.consulta(service.obter("indicadores_resumo"), filtro);
        jdbc.query(consulta.sql(), ps -> {
            for (int i = 0; i < consulta.parametros().size(); i++) ps.setObject(i + 1, consulta.parametros().get(i));
        }, rs -> {
            assertTrue(rs.next());
            assertEquals(2, rs.getLong(1));
            assertEquals(1, rs.getLong(2));
            assertEquals(0, rs.getBigDecimal(3).compareTo(new BigDecimal("20.00")));
            assertEquals(2, rs.getLong(5));
            return null;
        });

        var saida = new ByteArrayOutputStream();
        service.exportar(service.obter("vendas_periodo"), filtro, saida);
        try (var livro = WorkbookFactory.create(new ByteArrayInputStream(saida.toByteArray()))) {
            var dadosExcel = livro.getSheet("Dados 1");
            assertEquals(2, dadosExcel.getLastRowNum());
            assertEquals(20.0, livro.getSheet("Totais").getRow(3).getCell(1).getNumericCellValue());
        }
    }

    @Test
    void relatoriosExigemAdminTambemAoAcessarUrlsDiretamente() throws Exception {
        mvc.perform(get("/api/admin/relatorios"))
                .andExpect(status().is4xxClientError());
        mvc.perform(get("/api/admin/relatorios/vendas_periodo/xlsx"))
                .andExpect(status().is4xxClientError());
        mvc.perform(get("/api/admin/relatorios").with(user("operador").roles("OPERADOR")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/relatorios/vendas_periodo/xlsx").with(user("operador").roles("OPERADOR")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/relatorios").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").exists());
        mvc.perform(get("/api/admin/relatorios/vendas_periodo/xlsx")
                        .with(user("admin").roles("ADMIN"))
                        .param("inicio", "2026-02-01").param("fim", "2026-01-01"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/relatorios/relatorio_inexistente/xlsx")
                        .with(user("admin").roles("ADMIN")))
                .andExpect(status().isBadRequest());
    }
}
