// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.service;

import com.agerp.agerp.dto.ConfiguracaoSistemaRequest;
import com.agerp.agerp.entity.ConfiguracaoSistema;
import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.ConfiguracaoSistemaRepository;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ConfiguracaoSistemaServiceTest {

    private final ConfiguracaoSistemaRepository repository = mock(ConfiguracaoSistemaRepository.class);
    private final LogSistemaService auditoria = mock(LogSistemaService.class);
    private final CacheManager cacheManager = mock(CacheManager.class);
    private final ConfiguracaoSistemaService service =
            new ConfiguracaoSistemaService(repository, auditoria, cacheManager);

    private static ConfiguracaoSistema configuracao() {
        var c = new ConfiguracaoSistema();
        c.setId(1);
        c.setNomeEmpresa("AGERP");
        c.setLimiteEstoqueBaixo(15);
        c.setUsarEstoqueMinimoGeral(true);
        c.setExibirAlertasEstoque(true);
        c.setTimeoutIaMs(2000);
        c.setVersao(0L);
        c.setAtualizadoEm(Instant.parse("2026-01-01T00:00:00Z"));
        return c;
    }

    private static Usuario usuario(String perfil) {
        var p = new Perfil();
        p.setNome(perfil);
        var u = new Usuario();
        u.setNome("Administrador");
        u.setEmail("admin@example.test");
        u.setIdPerfil(p);
        return u;
    }

    @Test
    void consultaValoresPersistidosSemAlterarEstado() {
        when(repository.findById(1)).thenReturn(Optional.of(configuracao()));
        var resposta = service.consultar();
        assertEquals("AGERP", resposta.nomeEmpresa());
        assertEquals(15, service.limiteEstoqueBaixo());
        assertEquals(2000, service.timeoutIaMs());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void naoPermiteEdicaoSemPerfilAdmin() {
        var pedido = new ConfiguracaoSistemaRequest("Nova empresa", 10, true, false, 3000, 0L);
        assertThrows(AccessDeniedException.class, () -> service.atualizar(pedido, usuario("OPERADOR"), "127.0.0.1"));
        verifyNoInteractions(repository, auditoria);
    }

    @Test
    void versaoDesatualizadaNaoAlteraNemAudita() {
        when(repository.findById(1)).thenReturn(Optional.of(configuracao()));
        var pedido = new ConfiguracaoSistemaRequest("Nova empresa", 10, true, false, 3000, 1L);
        assertThrows(OptimisticLockingFailureException.class,
                () -> service.atualizar(pedido, usuario("ADMIN"), "127.0.0.1"));
        verify(repository, never()).saveAndFlush(any());
        verifyNoInteractions(auditoria, cacheManager);
    }

    @Test
    void auditoriaEInvalidaCachesSomenteAposCommit() {
        var entidade = configuracao();
        when(repository.findById(1)).thenReturn(Optional.of(entidade));
        when(repository.saveAndFlush(any())).thenAnswer(call -> {
            ConfiguracaoSistema salvo = call.getArgument(0);
            salvo.setVersao(1L); // simula o incremento @Version pelo Hibernate
            return salvo;
        });
        Cache cache = mock(Cache.class);
        when(cacheManager.getCache("dashboardRelatorio")).thenReturn(cache);
        var admin = usuario("ADMIN");
        var pedido = new ConfiguracaoSistemaRequest("Minha Empresa", 12, false, false, 4500, 0L);

        TransactionSynchronizationManager.initSynchronization();
        try {
            var resposta = service.atualizar(pedido, admin, "127.0.0.1");
            assertEquals(1L, resposta.versao());
            assertEquals("Minha Empresa", resposta.nomeEmpresa());
            assertEquals(12, service.limiteEstoqueBaixo());
            assertFalse(service.regraEstoque().usarGeral());
            verify(auditoria).registrarEvento(eq(admin), eq("ALTERACAO_CONFIGURACOES"),
                    eq("CONFIGURACAO"), eq("1"), eq("SUCESSO"),
                    isNull(), eq("127.0.0.1"),
                    argThat(mudancas -> mudancas.containsKey("timeoutIaMs")
                            && mudancas.containsKey("limiteEstoqueBaixo")
                            && !mudancas.containsKey("nomeEmpresa")));
            verify(cache, never()).clear();
            TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCommit());
            verify(cache).clear();
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void rejeitaDadosForaDoIntervalo() {
        try (var fabrica = Validation.buildDefaultValidatorFactory()) {
            var validator = fabrica.getValidator();
            assertFalse(validator.validate(new ConfiguracaoSistemaRequest(" ", 0, null, null, 100, -1L)).isEmpty());
            assertFalse(validator.validate(new ConfiguracaoSistemaRequest("Empresa", 1, null, true, 500, 0L)).isEmpty());
            assertTrue(validator.validate(new ConfiguracaoSistemaRequest("Empresa", 1, true, true, 500, 0L)).isEmpty());
            assertTrue(validator.validate(new ConfiguracaoSistemaRequest("Empresa", 100000, false, false, 15000, 0L)).isEmpty());
        }
    }
}
