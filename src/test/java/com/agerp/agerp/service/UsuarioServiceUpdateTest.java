package com.agerp.agerp.service;

import com.agerp.agerp.dto.UsuarioUpdateRequest;
import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.entity.StatusAcesso;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.PerfilRepository;
import com.agerp.agerp.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UsuarioServiceUpdateTest {
    private UsuarioRepository usuarios;
    private PerfilRepository perfis;
    private LogSistemaService logs;
    private UsuarioService service;
    private Usuario admin;

    @BeforeEach
    void setUp() {
        usuarios = mock(UsuarioRepository.class);
        perfis = mock(PerfilRepository.class);
        logs = mock(LogSistemaService.class);
        service = new UsuarioService(usuarios, perfis, mock(PasswordEncoder.class), logs);
        admin = usuario(1, perfil(1, "ADMIN"), StatusAcesso.APROVADO);
        when(usuarios.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void editaNomeEmailPerfilPreservaStatusEAudita() {
        Usuario alvo = usuario(2, perfil(2, "OPERADOR"), StatusAcesso.PENDENTE);
        Perfil gerente = perfil(3, "GERENTE");
        when(usuarios.findByIdForUpdate(2)).thenReturn(Optional.of(alvo));
        when(perfis.findById(3)).thenReturn(Optional.of(gerente));

        var response = service.atualizar(2,
                request("Nome Atualizado", "NOVO@AGERP.COM", 3), admin, "127.0.0.1");

        assertEquals("Nome Atualizado", response.getNome());
        assertEquals("novo@agerp.com", response.getEmail());
        assertEquals("GERENTE", response.getPerfilNome());
        assertEquals("PENDENTE", response.getStatusAcesso());
        assertFalse(response.getAtivo());
        assertEquals(1L, alvo.getCredentialVersion());
        verify(logs).registrarLog(eq(admin), contains("EDICAO_USUARIO_2_CAMPOS_"), eq("USUARIO"), eq("127.0.0.1"));
    }

    @Test
    void rejeitaEmailDuplicado() {
        Usuario alvo = usuario(2, perfil(2, "OPERADOR"), StatusAcesso.BLOQUEADO);
        when(usuarios.findByIdForUpdate(2)).thenReturn(Optional.of(alvo));
        when(perfis.findById(2)).thenReturn(Optional.of(alvo.getIdPerfil()));
        when(usuarios.existsByEmailIgnoreCaseAndIdNot("existente@agerp.com", 2)).thenReturn(true);

        assertThrows(IllegalArgumentException.class,
                () -> service.atualizar(2, request("Usuário Dois", "existente@agerp.com", 2), admin, null));
        assertEquals(StatusAcesso.BLOQUEADO, alvo.getStatusAcesso());
        verify(usuarios, never()).save(any());
    }

    @Test
    void rejeitaPerfilInexistente() {
        when(usuarios.findByIdForUpdate(2)).thenReturn(Optional.of(
                usuario(2, perfil(2, "OPERADOR"), StatusAcesso.APROVADO)));
        when(perfis.findById(99)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> service.atualizar(2, request("Usuário Dois", "u2@agerp.com", 99), admin, null));
    }

    @Test
    void protegeUltimoAdministradorContraRebaixamento() {
        Usuario alvo = usuario(2, perfil(1, "ADMIN"), StatusAcesso.APROVADO);
        when(usuarios.findByIdForUpdate(2)).thenReturn(Optional.of(alvo));
        when(perfis.findById(2)).thenReturn(Optional.of(perfil(2, "OPERADOR")));
        when(usuarios.countByStatusAcessoAndIdPerfilNome(StatusAcesso.APROVADO, "ADMIN")).thenReturn(1L);

        assertThrows(IllegalArgumentException.class,
                () -> service.atualizar(2, request("Administrador", "u2@agerp.com", 2), admin, null));
    }

    @Test
    void usuarioNaoAdministradorNaoPodeEditar() {
        Usuario operador = usuario(3, perfil(2, "OPERADOR"), StatusAcesso.APROVADO);
        assertThrows(AccessDeniedException.class,
                () -> service.atualizar(2, request("Usuário Dois", "u2@agerp.com", 2), operador, null));
        verifyNoInteractions(perfis);
    }

    private static UsuarioUpdateRequest request(String nome, String email, int idPerfil) {
        UsuarioUpdateRequest request = new UsuarioUpdateRequest();
        request.setNome(nome);
        request.setEmail(email);
        request.setIdPerfil(idPerfil);
        return request;
    }

    private static Perfil perfil(int id, String nome) {
        Perfil perfil = new Perfil();
        perfil.setId(id);
        perfil.setNome(nome);
        return perfil;
    }

    private static Usuario usuario(int id, Perfil perfil, StatusAcesso status) {
        Usuario usuario = new Usuario();
        usuario.setId(id);
        usuario.setNome("Usuário " + id);
        usuario.setEmail("u" + id + "@agerp.com");
        usuario.setIdPerfil(perfil);
        usuario.setStatusAcesso(status);
        usuario.setAtivo(status == StatusAcesso.APROVADO);
        usuario.setCredentialVersion(0L);
        return usuario;
    }
}
