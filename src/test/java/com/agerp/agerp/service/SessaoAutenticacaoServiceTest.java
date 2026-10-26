package com.agerp.agerp.service;

import com.agerp.agerp.entity.SessaoAutenticacao;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.SessaoAutenticacaoRepository;
import java.time.Instant;
import java.util.HashMap;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SessaoAutenticacaoServiceTest {
    @Test
    void logoutRevogaUmaSessaoSemAfetarOutraENaoPermiteReplay() {
        var repository = mock(SessaoAutenticacaoRepository.class);
        var byId = new HashMap<UUID, SessaoAutenticacao>();
        when(repository.saveAndFlush(any())).thenAnswer(call -> {
            SessaoAutenticacao s = call.getArgument(0);
            byId.put(s.getId(), s);
            return s;
        });
        when(repository.findById(any())).thenAnswer(call -> Optional.ofNullable(byId.get(call.getArgument(0))));
        var service = new SessaoAutenticacaoService(repository);
        Usuario owner = new Usuario();
        owner.setId(42);
        var a = service.criar(owner, UUID.randomUUID(), 60_000);
        var b = service.criar(owner, UUID.randomUUID(), 60_000);

        assertTrue(service.valida(a.getId(), owner.getId()));
        assertTrue(service.valida(b.getId(), owner.getId()));
        assertFalse(service.revogarDoUsuario(a.getId(), 999, "REVOGACAO_MANUAL"));
        service.revogar(a.getId(), "LOGOUT");
        service.revogar(a.getId(), "LOGOUT");
        assertFalse(service.valida(a.getId(), owner.getId()));
        assertTrue(service.valida(b.getId(), owner.getId()));
        assertEquals("LOGOUT", a.getMotivoRevogacao());
    }

    @Test
    void expiracaoENullNaoAutenticam() {
        var repository = mock(SessaoAutenticacaoRepository.class);
        var service = new SessaoAutenticacaoService(repository);
        Usuario owner = new Usuario();
        owner.setId(42);
        SessaoAutenticacao expired = new SessaoAutenticacao();
        expired.setId(UUID.randomUUID());
        expired.setUsuario(owner);
        expired.setExpiraEm(Instant.now().minusSeconds(1));
        when(repository.findById(expired.getId())).thenReturn(Optional.of(expired));
        assertFalse(service.valida(null, 42));
        assertFalse(service.valida(expired.getId(), 42));
        assertFalse(service.valida(expired.getId(), 999));
    }
}
