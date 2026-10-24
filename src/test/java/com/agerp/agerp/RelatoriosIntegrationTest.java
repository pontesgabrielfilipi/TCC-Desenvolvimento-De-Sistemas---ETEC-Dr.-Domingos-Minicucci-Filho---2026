package com.agerp.agerp;

import com.agerp.agerp.service.RelatorioAdminService;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.security.CustomUserDetailsService;
import com.agerp.agerp.security.jwt.JwtTokenProvider;
import jakarta.servlet.http.Cookie;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class RelatoriosIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired RelatorioAdminService service;
    @Autowired MockMvc mvc;
    @Autowired CustomUserDetailsService usuarios;
    @Autowired JwtTokenProvider tokens;

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
        return new Cookie("jwtToken", tokens.generateToken(autenticacao));
    }

    private org.apache.poi.ss.usermodel.Workbook baixarPlanilha(String id, Cookie cookie, Map<String, String> filtros)
            throws Exception {
        MockHttpServletRequestBuilder requisicao = get("/api/admin/relatorios/" + id + "/xlsx").cookie(cookie);
        filtros.forEach(requisicao::param);
        MvcResult pendente = mvc.perform(requisicao)
                .andExpect(request().asyncStarted())
                .andReturn();

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
