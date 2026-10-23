package com.agerp.agerp.service;

import com.agerp.agerp.dto.ConfiguracaoSistemaRequest;
import com.agerp.agerp.dto.ConfiguracaoSistemaResponse;
import com.agerp.agerp.entity.ConfiguracaoSistema;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.ConfiguracaoSistemaRepository;
import org.springframework.cache.CacheManager;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class ConfiguracaoSistemaService {
    private final ConfiguracaoSistemaRepository repository;
    private final LogSistemaService logSistemaService;
    private final CacheManager cacheManager;

    public ConfiguracaoSistemaService(ConfiguracaoSistemaRepository repository,
            LogSistemaService logSistemaService, CacheManager cacheManager) {
        this.repository = repository;
        this.logSistemaService = logSistemaService;
        this.cacheManager = cacheManager;
    }

    @Transactional(readOnly = true)
    public ConfiguracaoSistemaResponse consultar() {
        return resposta(configuracao());
    }

    @Transactional(readOnly = true)
    public ConfiguracaoSistemaResponse aparencia() {
        return resposta(configuracao());
    }

    public int limiteEstoqueBaixo() {
        return configuracao().getLimiteEstoqueBaixo();
    }

    public EstoqueBaixoService.Regra regraEstoque() {
        var c = configuracao();
        return new EstoqueBaixoService.Regra(c.getUsarEstoqueMinimoGeral(), c.getLimiteEstoqueBaixo());
    }

    public int timeoutIaMs() {
        return configuracao().getTimeoutIaMs();
    }

    @Transactional
    public ConfiguracaoSistemaResponse atualizar(ConfiguracaoSistemaRequest request, Usuario administrador, String ip) {
        if (administrador == null || administrador.getIdPerfil() == null
                || !"ADMIN".equalsIgnoreCase(administrador.getIdPerfil().getNome())) {
            throw new org.springframework.security.access.AccessDeniedException("Acesso administrativo necessario.");
        }
        String nome = request.nomeEmpresa().trim();
        if (nome.isBlank()) throw new IllegalArgumentException("Nome da empresa obrigatorio.");

        ConfiguracaoSistema config = configuracao();
        if (!Objects.equals(config.getVersao(), request.versao())) {
            throw new OptimisticLockingFailureException("Configuracoes alteradas por outro administrador. Recarregue a pagina.");
        }

        List<String> campos = new ArrayList<>();
        if (!nome.equals(config.getNomeEmpresa())) campos.add("nomeEmpresa");
        if (!request.limiteEstoqueBaixo().equals(config.getLimiteEstoqueBaixo())) campos.add("limiteEstoqueBaixo");
        if (!request.usarEstoqueMinimoGeral().equals(config.getUsarEstoqueMinimoGeral())) campos.add("usarEstoqueMinimoGeral");
        if (!request.exibirAlertasEstoque().equals(config.getExibirAlertasEstoque())) campos.add("exibirAlertasEstoque");
        if (!request.timeoutIaMs().equals(config.getTimeoutIaMs())) campos.add("timeoutIaMs");
        if (campos.isEmpty()) return resposta(config);

        config.setNomeEmpresa(nome);
        config.setLimiteEstoqueBaixo(request.limiteEstoqueBaixo());
        config.setUsarEstoqueMinimoGeral(request.usarEstoqueMinimoGeral());
        config.setExibirAlertasEstoque(request.exibirAlertasEstoque());
        config.setTimeoutIaMs(request.timeoutIaMs());
        config.setAtualizadoEm(Instant.now());
        repository.saveAndFlush(config);
        logSistemaService.registrarLog(administrador, "ALTERACAO_CONFIGURACOES", "CONFIGURACAO",
                "1", "SUCESSO", "Campos alterados: " + String.join(", ", campos), ip);

        // Evict only after commit: no other request may repopulate caches with uncommitted settings.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                for (String nomeCache : List.of("dashboardEstatisticas", "dashboardRelatorio",
                        "adminEstatisticas", "adminRelatorios", "produtosAtivos", "produtosTodos",
                        "produtoPorId", "pedidosPrevisaoIa")) {
                    var cache = cacheManager.getCache(nomeCache);
                    if (cache != null) cache.clear();
                }
            }
        });
        return resposta(config);
    }

    private ConfiguracaoSistema configuracao() {
        return repository.findById(1).orElseThrow(
                () -> new IllegalStateException("Configuracoes ausentes. Verifique a migration V6 do Flyway."));
    }

    private static ConfiguracaoSistemaResponse resposta(ConfiguracaoSistema c) {
        return new ConfiguracaoSistemaResponse(c.getNomeEmpresa(), c.getLimiteEstoqueBaixo(),
                c.getUsarEstoqueMinimoGeral(), c.getExibirAlertasEstoque(),
                c.getTimeoutIaMs(), c.getVersao(), c.getAtualizadoEm());
    }
}
