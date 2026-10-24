package com.agerp.agerp;

import com.agerp.agerp.service.EstoqueBaixoService;
import com.agerp.agerp.service.RelatorioAdminService;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RelatorioAdminServiceTest {
    @Test
    void relatorioSemEstoqueNaoConsultaConfiguracaoDeEstoque() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        EstoqueBaixoService estoque = mock(EstoqueBaixoService.class);
        when(estoque.regraAtual()).thenThrow(new IllegalStateException("Configuração de estoque indisponível"));
        var service = new RelatorioAdminService(jdbc, estoque);
        var relatorio = service.obter("clientes_cadastro");
        var filtros = new RelatorioAdminService.Filtros(null, null, null, null, null, null);

        assertDoesNotThrow(() -> service.consulta(relatorio, filtros));
        var saida = new ByteArrayOutputStream();
        assertDoesNotThrow(() -> service.exportar(relatorio, filtros, saida));
        try (var livro = WorkbookFactory.create(new ByteArrayInputStream(saida.toByteArray()))) {
            assertNotNull(livro.getSheet("Informações"));
            assertNotNull(livro.getSheet("Dados 1"));
        }
        verify(estoque, never()).regraAtual();
    }

    @Test
    void relatorioDeEstoqueConsultaRegraEfetiva() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        EstoqueBaixoService estoque = mock(EstoqueBaixoService.class);
        when(estoque.regraAtual()).thenThrow(new IllegalStateException("Configuração de estoque indisponível"));
        var service = new RelatorioAdminService(jdbc, estoque);
        var filtros = new RelatorioAdminService.Filtros(null, null, null, null, null, null);

        assertThrows(IllegalStateException.class, () -> service.consulta(service.obter("produtos_estoque"), filtros));
        verify(estoque).regraAtual();
    }
}
