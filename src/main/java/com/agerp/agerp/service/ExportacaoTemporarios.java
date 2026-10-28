package com.agerp.agerp.service;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.channels.OverlappingFileLockException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Spool XLSX exclusivo por JVM. A recuperação considera apenas arquivos próprios,
 * nomeados por UUID e dentro de diretórios bloqueados; o /tmp genérico nunca é varrido.
 */
@Component
public class ExportacaoTemporarios {
    private static final Logger LOG = LoggerFactory.getLogger(ExportacaoTemporarios.class);
    private static final Pattern RUN = Pattern.compile("run-[0-9a-f]{32}");
    private static final Pattern FILE = Pattern.compile("[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\\.xlsx");
    private final Path root;
    private final Path current;
    private final FileChannel channel;
    private final FileLock lease;
    private final ExportacaoAuditoriaService auditoria;

    @Autowired
    public ExportacaoTemporarios(ExportacaoAuditoriaService auditoria) throws IOException {
        this(Path.of(System.getProperty("java.io.tmpdir"), "agerp-xlsx-spool"), auditoria);
    }

    public ExportacaoTemporarios(Path root, ExportacaoAuditoriaService auditoria) throws IOException {
        this.root = root.toAbsolutePath().normalize();
        this.auditoria = auditoria;
        Files.createDirectories(this.root);
        this.current = Files.createDirectory(this.root.resolve("run-" + UUID.randomUUID().toString().replace("-", "")));
        this.channel = FileChannel.open(this.current.resolve("owner.lock"),
                StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
        this.lease = channel.lock();
    }

    public Path criar(UUID id) throws IOException {
        return Files.createFile(current.resolve(id + ".xlsx"));
    }

    public void apagar(Path file) {
        if (file == null) return;
        // Um caminho fornecido externamente nunca é apagado, mesmo que tenha nome semelhante.
        if (!current.equals(file.toAbsolutePath().normalize().getParent())
                || !FILE.matcher(file.getFileName().toString()).matches()) {
            throw new IllegalArgumentException("Arquivo fora da area de exportacao ativa");
        }
        try { Files.deleteIfExists(file); }
        catch (IOException ex) { LOG.warn("Nao foi possivel remover XLSX de {}", current.getFileName(), ex); }
    }

    @EventListener(ApplicationReadyEvent.class)
    public void recuperarNoStartup() {
        recuperar();
    }

    /** Retorna apenas a quantidade de XLSX órfãos removidos deste proprietário. */
    public int recuperar() {
        int removed = 0;
        try (var dirs = Files.list(root)) {
            for (Path dir : dirs.toList()) {
                if (dir.equals(current) || !RUN.matcher(dir.getFileName().toString()).matches()
                        || !Files.isDirectory(dir, LinkOption.NOFOLLOW_LINKS)) continue;
                Path lockPath = dir.resolve("owner.lock");
                if (!Files.isRegularFile(lockPath, LinkOption.NOFOLLOW_LINKS)) continue;
                try (FileChannel other = FileChannel.open(lockPath, StandardOpenOption.WRITE)) {
                    FileLock oldLease;
                    try { oldLease = other.tryLock(); }
                    catch (OverlappingFileLockException busy) { continue; }
                    if (oldLease == null) continue; // Outro processo ainda é proprietário desta execução.
                    try (oldLease; var files = Files.list(dir)) {
                        var entries = files.toList();
                        if (entries.stream().anyMatch(f -> !f.equals(lockPath) &&
                                (!FILE.matcher(f.getFileName().toString()).matches()
                                        || !Files.isRegularFile(f, LinkOption.NOFOLLOW_LINKS)))) {
                            LOG.warn("Diretorio de exportacao com conteudo desconhecido; preservado: {}", dir.getFileName());
                            continue;
                        }
                        for (Path file : entries) {
                            if (file.equals(lockPath)) continue;
                            UUID exportId = UUID.fromString(file.getFileName().toString().replace(".xlsx", ""));
                            Files.delete(file);
                            removed++;
                            try { auditoria.registrarRecuperacao(exportId); }
                            catch (RuntimeException ex) { LOG.error("Recuperado XLSX, mas auditoria falhou exportId={}", exportId, ex); }
                        }
                    }
                } catch (IOException ex) {
                    LOG.warn("Falha na recuperacao de {}; preservado para inspeção", dir.getFileName(), ex);
                    continue;
                }
                try { Files.deleteIfExists(lockPath); Files.deleteIfExists(dir); }
                catch (IOException ex) { LOG.warn("Nao foi possivel remover diretorio vazio {}", dir.getFileName(), ex); }
            }
        } catch (IOException ex) { LOG.error("Nao foi possivel varrer area privada de exportacoes", ex); }
        return removed;
    }

    @PreDestroy
    public void close() throws IOException {
        lease.release();
        channel.close();
    }
}
