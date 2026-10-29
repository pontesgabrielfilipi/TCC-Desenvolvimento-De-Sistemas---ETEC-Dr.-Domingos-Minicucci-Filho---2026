// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.Comparator;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ExportacaoTemporariosTest {
    private Path directory;

    @BeforeEach
    void preparar() throws Exception {
        directory = Files.createTempDirectory(Path.of("target"), "agerp-export-recovery-test-");
    }

    @AfterEach
    void limpar() throws Exception {
        try (var files = Files.walk(directory)) {
            for (var file : files.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(file);
        }
    }

    @Test
    void recuperaSomenteExecucaoAntigaComLockLiberado() throws Exception {
        var audit = mock(ExportacaoAuditoriaService.class);
        var former = new ExportacaoTemporarios(directory, audit);
        var id = UUID.randomUUID();
        var file = former.criar(id);
        Files.writeString(file, "incompleto");
        var running = new ExportacaoTemporarios(directory, audit);
        try {
            assertEquals(0, running.recuperar(), "Nenhum arquivo de processo ativo deve ser removido");
            assertTrue(Files.exists(file));
            former.close(); // Simula liberacao do lock pelo fim abrupto do processo.
            assertEquals(1, running.recuperar());
            assertFalse(Files.exists(file));
            verify(audit).registrarRecuperacao(id);
            assertEquals(0, running.recuperar(), "Recuperacao repetida deve ser idempotente");
        } finally {
            running.close();
        }
    }

    @Test
    void preservaArquivosAlheiosMesmoEmDiretorioComNomePlausivel() throws Exception {
        var audit = mock(ExportacaoAuditoriaService.class);
        var dir = Files.createDirectories(directory.resolve("run-" + UUID.randomUUID().toString().replace("-", "")));
        Files.createFile(dir.resolve("owner.lock"));
        Path foreign = Files.writeString(dir.resolve("manual.txt"), "preservar");
        Path suspected = Files.writeString(dir.resolve(UUID.randomUUID() + ".xlsx"), "preservar");
        var running = new ExportacaoTemporarios(directory, audit);
        try {
            assertEquals(0, running.recuperar());
            assertTrue(Files.exists(foreign));
            assertTrue(Files.exists(suspected));
            verifyNoInteractions(audit);
            assertThrows(IllegalArgumentException.class, () -> running.apagar(foreign));
        } finally { running.close(); }
    }

    @Test
    void killRealDeProcessoIsoladoLiberaLockEPermiteRecuperacao() throws Exception {
        String javaExe = System.getProperty("os.name").startsWith("Windows") ? "java.exe" : "java";
        Path java = Path.of(System.getProperty("java.home"), "bin", javaExe);
        Process probe = new ProcessBuilder(java.toString(), "-Xmx64m", "-cp",
                System.getProperty("java.class.path"), KillProbe.class.getName(), directory.toString())
                .redirectErrorStream(true).start();
        try {
            String message = CompletableFuture.supplyAsync(() -> {
                try { return probe.inputReader().readLine(); }
                catch (Exception error) { throw new IllegalStateException(error); }
            }).get(12, TimeUnit.SECONDS);
            assertNotNull(message, "Processo filho encerrou sem criar o spool");
            assertTrue(message.startsWith("READY:"), "Falha ao inicializar processo isolado: " + message);
            UUID id = UUID.fromString(message.substring("READY:".length()));
            var audit = mock(ExportacaoAuditoriaService.class);
            var survivor = new ExportacaoTemporarios(directory, audit);
            try {
                assertEquals(0, survivor.recuperar(), "Nao remover arquivo de processo com lock ativo");
                probe.destroyForcibly(); // Processo descartavel exclusivamente deste teste.
                assertTrue(probe.waitFor(10, TimeUnit.SECONDS));
                assertEquals(1, survivor.recuperar(), "Lock liberado pelo SO apos kill deve permitir coleta");
                verify(audit).registrarRecuperacao(id);
                assertEquals(0, survivor.recuperar());
            } finally { survivor.close(); }
        } finally {
            if (probe.isAlive()) {
                probe.destroyForcibly();
                probe.waitFor(10, TimeUnit.SECONDS);
            }
        }
    }

    /** A JVM isolada termina sem fechar o spool nem executar hook de desligamento. */
    public static class KillProbe {
        public static void main(String[] args) throws Exception {
            var temp = new ExportacaoTemporarios(Path.of(args[0]), null);
            UUID id = UUID.randomUUID();
            Files.writeString(temp.criar(id), "geracao-interrompida");
            System.out.println("READY:" + id);
            System.out.flush();
            Thread.sleep(120_000);
        }
    }
}
