package com.agerp.agerp.controller;

import com.agerp.agerp.service.ExportacaoAuditoriaService;
import com.agerp.agerp.service.ExportacaoTemporarios;
import com.agerp.agerp.service.RelatorioAdminService;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Path;
import java.nio.file.Files;
import java.util.Comparator;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Simula falhas antes e depois de comprometer a resposta XLSX, sem abrir sockets. */
class AdminRelatorioExportControllerTest {
    private RelatorioAdminService relatorios;
    private ExportacaoAuditoriaService auditoria;
    private AdminController controller;
    private HttpServletRequest request;
    private ExportacaoTemporarios spool;
    private Path scratch;

    @BeforeEach
    void preparar() throws IOException {
        scratch = Files.createTempDirectory(Path.of("target"), "agerp-export-controller-test-");
        relatorios = mock(RelatorioAdminService.class);
        auditoria = mock(ExportacaoAuditoriaService.class);
        request = mock(HttpServletRequest.class);
        spool = new ExportacaoTemporarios(scratch, auditoria);
        controller = new AdminController(null, null, null, null, null, null, null,
                null, relatorios, auditoria, spool, null, new java.util.concurrent.Semaphore(3, true));
        var report = new RelatorioAdminService.Relatorio("clientes_tipo", "Clientes", "Por tipo", "Contagem",
                "c.tipo,COUNT(*)", " FROM agerp.cliente c WHERE 1=1", " GROUP BY c.tipo",
                java.util.List.of(new RelatorioAdminService.Coluna("Tipo", 't', false),
                        new RelatorioAdminService.Coluna("Clientes", 'n', true)),
                new RelatorioAdminService.Escopo(null, null, null, null, null));
        when(relatorios.obter("clientes_tipo")).thenReturn(report);
    }

    @AfterEach
    void fechar() throws IOException {
        spool.close();
        try (var files = Files.walk(scratch)) {
            for (var file : files.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(file);
        }
    }

    @Test
    void geracaoFalhaAntesDosHeadersERespondeErroEstruturavel() throws Exception {
        when(relatorios.exportarComContagem(any(), any(), any(OutputStream.class), isNull()))
                .thenThrow(new IOException("falha de escrita simulada"));

        ResponseStatusException erro = assertThrows(ResponseStatusException.class, this::exportar);
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, erro.getStatusCode());
        assertTrue(erro.getReason().contains("Referência:"));
        verify(auditoria).registrar(any(), eq("EXPORTACAO_SOLICITADA"), eq("INICIADO"),
                isNull(), isNull(), eq(0L), isNull());
        verify(auditoria).registrar(any(), eq("EXPORTACAO_FALHA"), eq("FALHA"),
                isNull(), isNull(), anyLong(), eq("GERACAO"));
        verify(auditoria, never()).registrar(any(), eq("EXPORTACAO_GERADA"), anyString(),
                any(), any(), anyLong(), any());
    }

    @Test
    void interrupcaoDuranteStreamRegistraFalhaSemDeclararTransmissaoEncerrada() throws Exception {
        when(relatorios.exportarComContagem(any(), any(), any(OutputStream.class), isNull()))
                .thenAnswer(invocation -> {
                    try (var livro = new XSSFWorkbook()) {
                        livro.createSheet("Dados 1").createRow(0).createCell(0).setCellValue("Tipo");
                        livro.write(invocation.getArgument(2));
                    }
                    return 1;
                });

        var resposta = exportar();
        assertEquals(HttpStatus.OK, resposta.getStatusCode());
        assertNotNull(resposta.getHeaders().getFirst("X-Export-ID"));
        assertNotNull(resposta.getBody());
        OutputStream socketInterrompido = new OutputStream() {
            @Override
            public void write(int value) throws IOException {
                throw new IOException("conexao interrompida simulada");
            }
        };
        assertThrows(IOException.class, () -> resposta.getBody().writeTo(socketInterrompido));

        verify(auditoria).registrar(any(), eq("EXPORTACAO_GERADA"), eq("SUCESSO"),
                eq(1), longThat(n -> n > 100), anyLong(), isNull());
        verify(auditoria).registrar(any(), eq("EXPORTACAO_FALHA"), eq("FALHA"),
                eq(1), longThat(n -> n > 100), anyLong(), eq("TRANSMISSAO_OU_CONEXAO"));
        verify(auditoria, never()).registrar(any(), eq("EXPORTACAO_TRANSMISSAO_ENCERRADA"),
                anyString(), any(), any(), anyLong(), any());
    }

    private org.springframework.http.ResponseEntity<org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody>
    exportar() {
        return controller.exportarRelatorio("clientes_tipo", null, null, null, null,
                null, null, null, request);
    }
}
