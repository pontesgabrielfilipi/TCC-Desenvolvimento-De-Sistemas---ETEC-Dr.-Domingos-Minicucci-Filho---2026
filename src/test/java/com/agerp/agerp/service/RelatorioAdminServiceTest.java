package com.agerp.agerp.service;

import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.PreparedStatementCreator;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RelatorioAdminServiceTest {
    @Mock JdbcTemplate jdbc;
    @Mock EstoqueBaixoService estoque;
    private RelatorioAdminService service;

    @BeforeEach
    void setup() {
        service = new RelatorioAdminService(jdbc, estoque);
        lenient().when(estoque.regraAtual()).thenReturn(new EstoqueBaixoService.Regra(true, 15));
    }

    private static RelatorioAdminService.Filtros semFiltros() {
        return new RelatorioAdminService.Filtros(null, null, null, null, null, null);
    }

    @Test
    void catalogoTemCoberturaDeEntidadesCargosEstoqueEAuditoriaSemSegredos() {
        var ids = service.catalogo().stream().map(RelatorioAdminService.Relatorio::id).toList();
        assertTrue(ids.size() >= 30);
        assertTrue(ids.containsAll(List.of("clientes_cadastro", "clientes_ranking", "produtos_estoque_baixo", "produtos_custos",
                "estoque_movimentacoes", "pedidos_itens", "vendas_periodo", "indicadores_resumo",
                "usuarios_cargos", "usuarios_atividade", "auditoria_logs", "entregas_registradas")));
        service.catalogo().forEach(r -> {
            assertFalse(r.select().toLowerCase().contains("senha_hash"));
            assertFalse(r.select().toLowerCase().contains("token"));
            assertFalse(r.colunas().isEmpty());
        });
    }

    @Test
    void consultaUsaParametrosParaFiltrosEDataFinalInclusiva() {
        var filtros = new RelatorioAdminService.Filtros(LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 1, 31), 3, 4, 5, "entregue");
        var consulta = service.consulta(service.obter("pedidos_itens"), filtros);
        assertTrue(consulta.sql().contains("p.data_pedido >= ?"));
        assertTrue(consulta.sql().contains("p.data_pedido < ?"));
        assertTrue(consulta.sql().contains("p.id_cliente = ?"));
        assertTrue(consulta.sql().contains("i.id_produto = ?"));
        assertTrue(consulta.sql().contains("p.id_usuario = ?"));
        assertTrue(consulta.sql().contains("UPPER(p.status) = ?"));
        assertEquals(List.of(LocalDateTime.of(2026,1,1,0,0), LocalDateTime.of(2026,2,1,0,0),
                3, 4, 5, "ENTREGUE"), consulta.parametros());
        assertThrows(IllegalArgumentException.class, () -> new RelatorioAdminService.Filtros(
                LocalDate.of(2026,2,1), LocalDate.of(2026,1,1), null,null,null,null));
    }

    @Test
    void resumoRepeteFiltrosEmSubconsultaNaOrdemDosParametros() {
        var filtros = new RelatorioAdminService.Filtros(null, null, 3, null, 7, "CANCELADO");
        var consulta = service.consulta(service.obter("indicadores_resumo"), filtros);
        assertEquals(List.of(3, 7, "CANCELADO", 3, 7, "CANCELADO"), consulta.parametros());
        assertEquals(6, consulta.sql().chars().filter(c -> c == '?').count());
        assertTrue(consulta.sql().contains("COALESCE(i.quantidade,0)"));
    }

    @Test
    void aplicaConfiguracaoGeralEIndividualEExcluiSaldoNaoRegistrado() {
        var relatorio = service.obter("produtos_estoque_baixo");
        var geral = service.consulta(relatorio, semFiltros());
        assertTrue(geral.sql().contains("e.quantidade_atual < 15"));
        assertTrue(geral.sql().contains("e.quantidade_atual IS NOT NULL"));
        when(estoque.regraAtual()).thenReturn(new EstoqueBaixoService.Regra(false, 15));
        var individual = service.consulta(relatorio, semFiltros());
        assertTrue(individual.sql().contains("e.quantidade_atual < COALESCE(e.quantidade_minima,10)"));
    }

    @Test
    void xlsxValidoPreservaTextoZeradoEFormulaLiteralComCabecalhosEDatas() throws Exception {
        var linhas = List.<Object[]>of(
                new Object[] {1, "=SUM(1,2)", "PF", "00123456789", "teste@exemplo.com", "0011999999999", Timestamp.valueOf("2026-01-01 10:30:00")},
                new Object[] {2, "Cliente Dois", "PJ", "00001234000199", null, null, Timestamp.valueOf("2026-01-02 11:00:00")}
        );
        simularResultado(linhas);
        var saida = new ByteArrayOutputStream();
        service.exportar(service.obter("clientes_cadastro"), semFiltros(), saida);
        assertTrue(saida.size() > 1000);
        try (var workbook = WorkbookFactory.create(new ByteArrayInputStream(saida.toByteArray()))) {
            assertNotNull(workbook.getSheet("Informações"));
            var dados = workbook.getSheet("Dados 1");
            assertNotNull(dados);
            assertEquals("CPF / CNPJ", dados.getRow(0).getCell(3).getStringCellValue());
            assertEquals(CellType.STRING, dados.getRow(1).getCell(1).getCellType());
            assertEquals("=SUM(1,2)", dados.getRow(1).getCell(1).getStringCellValue());
            assertEquals("00123456789", dados.getRow(1).getCell(3).getStringCellValue());
            assertEquals("0011999999999", dados.getRow(1).getCell(5).getStringCellValue());
            assertEquals(CellType.NUMERIC, dados.getRow(1).getCell(0).getCellType());
            assertEquals(CellType.NUMERIC, dados.getRow(1).getCell(6).getCellType());
            assertEquals(1, dados.getPaneInformation().getHorizontalSplitPosition());
            assertEquals(2, workbook.getSheet("Informações").getRow(12).getCell(1).getNumericCellValue());
        }
    }

    @Test
    void xlsxTotaisSaoNumericosEExportacaoVaziaAbreNormalmente() throws Exception {
        simularResultado(List.of(new Object[]{LocalDate.of(2026,1,1), 2L, 1L, new BigDecimal("10.50")},
                new Object[]{LocalDate.of(2026,1,2), 3L, 2L, new BigDecimal("3.25")}));
        var saida = new ByteArrayOutputStream();
        service.exportar(service.obter("vendas_periodo"), semFiltros(), saida);
        try (var workbook = WorkbookFactory.create(new ByteArrayInputStream(saida.toByteArray()))) {
            var totais = workbook.getSheet("Totais");
            assertEquals(5, totais.getRow(1).getCell(1).getNumericCellValue());
            assertEquals(3, totais.getRow(2).getCell(1).getNumericCellValue());
            assertEquals(13.75, totais.getRow(3).getCell(1).getNumericCellValue(), 0.001);
        }

        simularResultado(List.of());
        var vazio = new ByteArrayOutputStream();
        service.exportar(service.obter("vendas_periodo"), semFiltros(), vazio);
        try (var workbook = WorkbookFactory.create(new ByteArrayInputStream(vazio.toByteArray()))) {
            assertEquals(0, workbook.getSheet("Informações").getRow(12).getCell(1).getNumericCellValue());
            assertTrue(workbook.getSheet("Dados 1").getRow(1).getCell(0).getStringCellValue().contains("Nenhum registro"));
        }
    }

    private void simularResultado(List<Object[]> linhas) {
        doAnswer(inv -> {
            RowCallbackHandler callback = inv.getArgument(1);
            for (var linha : linhas) {
                ResultSet rs = mock(ResultSet.class);
                when(rs.getObject(anyInt())).thenAnswer(chamada -> linha[(int) chamada.getArgument(0) - 1]);
                callback.processRow(rs);
            }
            return null;
        }).when(jdbc).query(any(PreparedStatementCreator.class), any(RowCallbackHandler.class));
    }
}
