package com.agerp.agerp.service;

import com.agerp.agerp.entity.LogSistema;
import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.LogSistemaRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LogSistemaServiceTest {

    @Test
    void gravaSnapshotsEIdentificadorSemDadosDeCredencial() {
        LogSistemaRepository repository = mock(LogSistemaRepository.class);
        LogSistemaService service = new LogSistemaService(repository);
        Perfil perfil = new Perfil(); perfil.setNome("ADMIN");
        Usuario usuario = new Usuario();
        usuario.setNome("Ada"); usuario.setEmail("ada@example.com"); usuario.setIdPerfil(perfil);

        service.registrarLog(usuario, "EDICAO_USUARIO_42_CAMPOS_EMAIL", "USUARIO", "127.0.0.1");

        ArgumentCaptor<LogSistema> captor = ArgumentCaptor.forClass(LogSistema.class);
        verify(repository).save(captor.capture());
        LogSistema log = captor.getValue();
        assertEquals("ada@example.com", log.getUsuarioEmail());
        assertEquals("ADMIN", log.getUsuarioPerfil());
        assertEquals("42", log.getRecursoId());
        assertEquals("SUCESSO", log.getResultado());
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
