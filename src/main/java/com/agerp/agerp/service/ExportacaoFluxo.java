package com.agerp.agerp.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Path;
import java.util.concurrent.Semaphore;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/** Exactly one terminal event and release, including MVC async error/timeout. */
public final class ExportacaoFluxo {
    private static final Logger LOG = LoggerFactory.getLogger(ExportacaoFluxo.class);
    private final AtomicBoolean ended = new AtomicBoolean(false);
    private final AtomicBoolean streaming = new AtomicBoolean(false);
    private final AtomicReference<String> asyncFailure = new AtomicReference<>();
    private volatile CountDownLatch filtersFinished;
    private final ExportacaoTemporarios spool;
    private final ExportacaoAuditoriaService auditoria;
    private final ExportacaoAuditoriaService.Contexto contexto;
    private final Path arquivo;
    private final Semaphore capacidade;
    private final int registros;
    private final long bytes;
    private final long inicioNs;

    public ExportacaoFluxo(ExportacaoTemporarios spool, ExportacaoAuditoriaService auditoria,
            ExportacaoAuditoriaService.Contexto contexto, Path arquivo, Semaphore capacidade,
            int registros, long bytes, long inicioNs) {
        this.spool = spool;
        this.auditoria = auditoria;
        this.contexto = contexto;
        this.arquivo = arquivo;
        this.capacidade = capacidade;
        this.registros = registros;
        this.bytes = bytes;
        this.inicioNs = inicioNs;
    }

    /** Synchronize callback writes with final response headers from servlet filters. */
    public void aguardarFiltros(CountDownLatch barrier) { filtersFinished = barrier; }

    public void aguardarCabecalhos() throws java.io.IOException {
        CountDownLatch barrier = filtersFinished;
        if (barrier == null) return;
        try { barrier.await(); }
        catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new java.io.IOException("Transmissao interrompida antes dos cabecalhos", interrupted);
        }
    }

    /** Called immediately before opening the spool for transmission. */
    public void iniciarTransmissao() { streaming.set(true); }

    /** A timeout may race with a blocked socket write: retain resources until the callback exits. */
    public void falhaAsync(String motivo) {
        asyncFailure.compareAndSet(null, motivo);
        if (!streaming.get()) falha(motivo);
    }

    public void sucesso() {
        String motivo = asyncFailure.get();
        if (motivo == null) concluir("EXPORTACAO_TRANSMISSAO_ENCERRADA", "OBSERVADO", null);
        else concluir("EXPORTACAO_FALHA", "FALHA", motivo);
    }

    public void falha(String motivo) {
        String async = asyncFailure.get();
        concluir("EXPORTACAO_FALHA", "FALHA", async == null ? motivo : async);
    }

    private void concluir(String acao, String resultado, String motivo) {
        if (!ended.compareAndSet(false, true)) return;
        try {
            auditoria.registrar(contexto, acao, resultado, registros, bytes,
                    TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - inicioNs), motivo);
        } catch (RuntimeException erro) {
            LOG.error("Auditoria terminal indisponivel, exportId={}", contexto.exportId(), erro);
        } finally {
            spool.apagar(arquivo);
            capacidade.release();
        }
    }
}
