// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.config;

import com.agerp.agerp.service.ExportacaoAuditoriaService;
import com.agerp.agerp.service.ExportacaoFluxo;
import com.agerp.agerp.service.ExportacaoTemporarios;
import jakarta.servlet.AsyncContext;
import jakarta.servlet.AsyncEvent;
import jakarta.servlet.AsyncListener;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ThreadPoolExecutor;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ExportacaoAsyncLifecycleTest {
    @Test
    void executorLimitadoRejeitaEVoltaAReceberTrabalho() throws Exception {
        var pool = new ThreadPoolTaskExecutor();
        pool.setCorePoolSize(1);
        pool.setMaxPoolSize(1);
        pool.setQueueCapacity(0);
        pool.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        pool.initialize();
        var started = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        try {
            pool.execute(() -> {
                started.countDown();
                try { release.await(5, TimeUnit.SECONDS); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            });
            assertTrue(started.await(2, TimeUnit.SECONDS));
            TaskRejectedException rejected = assertThrows(TaskRejectedException.class,
                    () -> pool.execute(() -> {}));
            var response = new GlobalExceptionHandler().handleAsyncExecutorEsgotado(rejected);
            assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
            assertTrue(response.getBody().message().contains("Tente novamente"));
            release.countDown();
            var completed = new CountDownLatch(1);
            boolean accepted = false;
            for (int i = 0; i < 20 && !accepted; i++) {
                try { pool.execute(completed::countDown); accepted = true; }
                catch (TaskRejectedException busy) { Thread.sleep(25); }
            }
            assertTrue(accepted);
            assertTrue(completed.await(2, TimeUnit.SECONDS));
        } finally {
            release.countDown();
            pool.shutdown();
        }
    }

    @Test
    void timeoutEConclusaoPosteriorProduzemUmTerminalELiberacao() throws Exception {
        var spool = mock(ExportacaoTemporarios.class);
        var audit = mock(ExportacaoAuditoriaService.class);
        var contexto = new ExportacaoAuditoriaService.Contexto(UUID.randomUUID(), null,
                null, null, null, null, null, null, "relatorio", Map.of());
        var capacity = new Semaphore(0);
        var path = Path.of("export-unit.xlsx");
        var flow = new ExportacaoFluxo(spool, audit, contexto, path, capacity, 10, 100,
                System.nanoTime());
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        AsyncContext async = mock(AsyncContext.class);
        when(request.getAttribute(ExportacaoAsyncCleanupFilter.ATTR)).thenReturn(flow);
        when(request.isAsyncStarted()).thenReturn(true);
        when(request.getAsyncContext()).thenReturn(async);
        FilterChain chain = mock(FilterChain.class);
        new ExportacaoAsyncCleanupFilter().doFilter(request, response, chain);

        var capture = org.mockito.ArgumentCaptor.forClass(AsyncListener.class);
        verify(async).addListener(capture.capture());
        capture.getValue().onTimeout(new AsyncEvent(async));
        capture.getValue().onComplete(new AsyncEvent(async));
        flow.sucesso();

        verify(audit, times(1)).registrar(eq(contexto), eq("EXPORTACAO_FALHA"),
                eq("FALHA"), eq(10), eq(100L), anyLong(), eq("ASYNC_TIMEOUT"));
        verify(spool, times(1)).apagar(path);
        assertEquals(1, capacity.availablePermits());
    }

    @Test
    void timeoutDuranteStreamNaoRemoveArquivoNemLiberaVagaAntesDoFimDaThread() {
        var spool = mock(ExportacaoTemporarios.class);
        var audit = mock(ExportacaoAuditoriaService.class);
        var contexto = new ExportacaoAuditoriaService.Contexto(UUID.randomUUID(), null,
                null, null, null, null, null, null, "relatorio", Map.of());
        var capacity = new Semaphore(0);
        var path = Path.of("em-transmissao.xlsx");
        var flow = new ExportacaoFluxo(spool, audit, contexto, path, capacity, 10, 100,
                System.nanoTime());
        flow.iniciarTransmissao();
        flow.falhaAsync("ASYNC_TIMEOUT");
        verifyNoInteractions(spool, audit);
        assertEquals(0, capacity.availablePermits(), "Timeout nao pode liberar socket ainda ativo");
        flow.sucesso(); // callback acaba apos timeout: nao declarar sucesso
        verify(audit).registrar(eq(contexto), eq("EXPORTACAO_FALHA"), eq("FALHA"),
                eq(10), eq(100L), anyLong(), eq("ASYNC_TIMEOUT"));
        verify(spool).apagar(path);
        assertEquals(1, capacity.availablePermits());
    }
}
