// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.service;

import com.agerp.agerp.dto.UsuarioCreateRequest;
import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.entity.StatusAcesso;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.PerfilRepository;
import com.agerp.agerp.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UsuarioServiceApprovalTest {
    private UsuarioRepository usuarios;
    private PerfilRepository perfis;
    private LogSistemaService logs;
    private UsuarioService service;

    @BeforeEach
    void setUp() {
        usuarios = mock(UsuarioRepository.class);
        perfis = mock(PerfilRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        logs = mock(LogSistemaService.class);
        service = new UsuarioService(usuarios, perfis, encoder, logs);
        when(perfis.findAdminForUpdate()).thenReturn(Optional.of(perfil("ADMIN")));
        when(encoder.encode(anyString())).thenReturn("hash");
        when(usuarios.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void cadastroPublicoIgnoraPerfilSolicitadoECriaPendente() {
        Perfil operador = perfil("OPERADOR");
        when(perfis.findByNome("OPERADOR")).thenReturn(Optional.of(operador));
        UsuarioCreateRequest request = new UsuarioCreateRequest("Novo Usuário", "novo@agerp.com", "123456", 1);

        var response = service.criar(request);

        assertEquals("PENDENTE", response.getStatusAcesso());
        assertFalse(response.getAtivo());
        assertEquals("OPERADOR", response.getPerfilNome());
        verify(perfis, never()).findById(1);
    }

    @Test
    void administradorAprovaPendenteEAudita() {
        Usuario admin = usuario(1, "ADMIN", StatusAcesso.APROVADO);
        Usuario alvo = usuario(2, "OPERADOR", StatusAcesso.PENDENTE);
        when(usuarios.findByIdForUpdate(2)).thenReturn(Optional.of(alvo));

        var response = service.alterarStatus(2, StatusAcesso.APROVADO, admin, "127.0.0.1");

        assertEquals("APROVADO", response.getStatusAcesso());
        assertTrue(response.getAtivo());
        verify(logs).registrarEvento(eq(admin), eq("APROVACAO_USUARIO_2"), eq("USUARIO"), eq("2"), eq("SUCESSO"), isNull(), eq("127.0.0.1"), argThat(changes -> changes.containsKey("status") && changes.containsKey("ativo")));
    }

    @Test
    void impedeAutoAlteracao() {
        Usuario admin = usuario(1, "ADMIN", StatusAcesso.APROVADO);
        assertThrows(IllegalArgumentException.class,
                () -> service.alterarStatus(1, StatusAcesso.BLOQUEADO, admin, null));
        verifyNoInteractions(logs);
    }

    @Test
    void impedeBloqueioDoUltimoAdministrador() {
        Usuario adminExecutor = usuario(1, "ADMIN", StatusAcesso.APROVADO);
        Usuario ultimoAdmin = usuario(2, "ADMIN", StatusAcesso.APROVADO);
        when(usuarios.findByIdForUpdate(2)).thenReturn(Optional.of(ultimoAdmin));
        when(usuarios.countByStatusAcessoAndIdPerfilNome(StatusAcesso.APROVADO, "ADMIN")).thenReturn(1L);

        assertThrows(IllegalArgumentException.class,
                () -> service.alterarStatus(2, StatusAcesso.BLOQUEADO, adminExecutor, null));
        verify(usuarios, never()).save(ultimoAdmin);
    }

    @Test
    void rejeitaTransicaoInvalida() {
        Usuario admin = usuario(1, "ADMIN", StatusAcesso.APROVADO);
        Usuario aprovado = usuario(2, "OPERADOR", StatusAcesso.APROVADO);
        when(usuarios.findByIdForUpdate(2)).thenReturn(Optional.of(aprovado));

        assertThrows(IllegalArgumentException.class,
                () -> service.alterarStatus(2, StatusAcesso.REJEITADO, admin, null));
    }

    private static Perfil perfil(String nome) {
        Perfil perfil = new Perfil();
        perfil.setNome(nome);
        return perfil;
    }

    private static Usuario usuario(int id, String perfilNome, StatusAcesso status) {
        Usuario usuario = new Usuario();
        usuario.setId(id);
        usuario.setNome("Usuário " + id);
        usuario.setEmail("u" + id + "@agerp.com");
        usuario.setIdPerfil(perfil(perfilNome));
        usuario.setStatusAcesso(status);
        usuario.setAtivo(status == StatusAcesso.APROVADO);
        return usuario;
    }
}
