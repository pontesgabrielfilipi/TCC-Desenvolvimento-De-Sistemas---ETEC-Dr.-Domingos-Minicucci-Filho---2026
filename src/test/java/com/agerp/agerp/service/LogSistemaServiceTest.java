package com.agerp.agerp.service;

import com.agerp.agerp.entity.LogSistema;
import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.LogSistemaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.junit.jupiter.api.AfterEach;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

class LogSistemaServiceTest {
    @Test void rejeitaRequestIdInvalidoEPeriodoInvertido() {
        var service = new LogSistemaService(mock(LogSistemaRepository.class));
        var page = PageRequest.of(0, 20);
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.pesquisarAvancado(null, null, null, null, null, null, null,
                        "not-a-uuid", null, null, null, null, null, page));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.pesquisarAvancado(null, null, null, null, null, null, null,
                        null, null, null, null, java.time.Instant.parse("2026-10-25T00:00:00Z"),
                        java.time.Instant.parse("2026-10-24T00:00:00Z"), page));
    }

    @SuppressWarnings("unchecked")
    @Test void legadoSemSnapshotNaoInventaIdentidadeNemDetalhesLivres() {
        var repo = mock(LogSistemaRepository.class);
        var log = new LogSistema();
        log.setDetalhes("old password=SECRET");
        when(repo.findAll(any(Specification.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(java.util.List.of(log)));
        var page = new LogSistemaService(repo).pesquisarAvancado(null, null, null, null, null,
                null, null, null, null, null, null, null, null, PageRequest.of(0, 20));
        var item = page.getContent().getFirst();
        assertEquals("Desconhecido", item.getNomeUsuario());
        org.junit.jupiter.api.Assertions.assertFalse(item.isIdentidadeHistoricaConfirmada());
        org.junit.jupiter.api.Assertions.assertNull(item.getDetalhes());
        assertEquals("DESCONHECIDA", item.getOrigemConfianca());
    }
    @AfterEach void tearDown() { TransactionSynchronizationManager.setActualTransactionActive(false); }

    @Test
    void gravaSnapshotsEIdentificadorSemDadosDeCredencial() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        LogSistemaRepository repository = mock(LogSistemaRepository.class);
        LogSistemaService service = new LogSistemaService(repository);
        Perfil perfil = new Perfil(); perfil.setNome("ADMIN");
        Usuario usuario = new Usuario();
        usuario.setNome("Ada"); usuario.setEmail("ada@example.com"); usuario.setIdPerfil(perfil);

        service.registrarLog(usuario, "EDICAO_USUARIO_42_CAMPOS_EMAIL", "USUARIO", "127.0.0.1");

        ArgumentCaptor<LogSistema> captor = ArgumentCaptor.forClass(LogSistema.class);
        verify(repository).saveAndFlush(captor.capture());
        LogSistema log = captor.getValue();
        assertEquals("ada@example.com", log.getUsuarioEmail());
        assertEquals("ADMIN", log.getUsuarioPerfil());
        assertEquals("42", log.getRecursoId());
        assertEquals("SUCESSO", log.getResultado());
        org.junit.jupiter.api.Assertions.assertNotNull(log.getEventId());
        org.junit.jupiter.api.Assertions.assertNull(log.getDetalhes());
    }

    @Test void naoRegistraSucessoSemTransacaoAtiva() {
        LogSistemaService service = new LogSistemaService(mock(LogSistemaRepository.class));
        assertThrows(IllegalStateException.class,
                () -> service.registrarLog(null, "EDITAR", "USUARIO", "127.0.0.1"));
    }

    @Test void persistenciaObrigatoriaFalhandoPropagaExcecao() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        LogSistemaRepository repo = mock(LogSistemaRepository.class);
        doThrow(new IllegalStateException("database unavailable")).when(repo).saveAndFlush(any());
        assertThrows(IllegalStateException.class,
                () -> new LogSistemaService(repo).registrarLog(null, "EDITAR", "USUARIO", "127.0.0.1"));
    }

    @Test void allowlistDeDiferencasNaoSerializaSegredos() {
        var changes = LogSistemaService.sanitizeChanges(java.util.Map.of(
                "status", "APROVADO", "senha", "super-secret", "jwtToken", "abcdef", "ativo", true));
        assertEquals("APROVADO", changes.get("status"));
        assertEquals(true, changes.get("ativo"));
        org.junit.jupiter.api.Assertions.assertFalse(changes.containsKey("senha"));
        org.junit.jupiter.api.Assertions.assertFalse(changes.containsKey("jwtToken"));
    }

    @Test void mascaraCredenciaisMesmoEmCampoPermitido() {
        var changes = LogSistemaService.sanitizeChanges(java.util.Map.of("nome", "Bearer abcdef"));
        assertEquals("[REDACTED]", changes.get("nome"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void pesquisaRetornaSnapshotMesmoSeCadastroAtualMudou() {
        LogSistemaRepository repository = mock(LogSistemaRepository.class);
        LogSistemaService service = new LogSistemaService(repository);
        LogSistema log = new LogSistema();
        log.setUsuarioNome("Nome histórico"); log.setUsuarioEmail("antigo@example.com");
        log.setUsuarioPerfil("OPERADOR");
        when(repository.findAll(any(Specification.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(java.util.List.of(log)));

        var pagina = service.pesquisar("antigo", "oper", "login", null, null, PageRequest.of(0, 10));

        assertEquals("antigo@example.com", pagina.getContent().getFirst().getEmailUsuario());
        assertEquals("OPERADOR", pagina.getContent().getFirst().getPerfilUsuario());
    }
}
