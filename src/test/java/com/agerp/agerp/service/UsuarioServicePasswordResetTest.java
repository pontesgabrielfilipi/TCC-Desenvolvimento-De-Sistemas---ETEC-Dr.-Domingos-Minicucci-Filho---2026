package com.agerp.agerp.service;

import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.entity.StatusAcesso;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.PerfilRepository;
import com.agerp.agerp.repository.UsuarioRepository;
import com.agerp.agerp.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class UsuarioServicePasswordResetTest {
    private final UsuarioRepository usuarios = mock(UsuarioRepository.class);
    private final LogSistemaService logs = mock(LogSistemaService.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private UsuarioService service;

    @BeforeEach
    void setUp() {
        service = new UsuarioService(usuarios, mock(PerfilRepository.class), encoder, logs);
        when(usuarios.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void adminRedefineComHashVersaoEAuditoriaPreservandoAprovacao() {
        Usuario admin = usuario(1, "ADMIN", StatusAcesso.APROVADO);
        Usuario alvo = usuario(2, "OPERADOR", StatusAcesso.PENDENTE);
        alvo.setAtivo(false);
        alvo.setSenhaHash(encoder.encode("senha-antiga"));
        when(usuarios.findByIdForUpdate(2)).thenReturn(Optional.of(alvo));

        var resposta = service.redefinirSenha(2, admin, "127.0.0.1");

        assertTrue(encoder.matches(resposta.senhaTemporaria(), alvo.getCredencialTemporariaHash()));
        assertFalse(encoder.matches("senha-antiga", alvo.getCredencialTemporariaHash()));
        CustomUserDetails temporario = new CustomUserDetails(alvo, List.of());
        assertEquals(alvo.getCredencialTemporariaHash(), temporario.getPassword());
        assertNotEquals(alvo.getSenhaHash(), temporario.getPassword());
        assertEquals(1L, alvo.getCredentialVersion());
        assertTrue(alvo.getTrocaSenhaObrigatoria());
        assertEquals(StatusAcesso.PENDENTE, alvo.getStatusAcesso());
        assertFalse(alvo.getAtivo());
        verify(logs).registrarLog(admin, "REDEFINICAO_SENHA_USUARIO_2", "USUARIO", "127.0.0.1");
    }

    @Test
    void usuarioComumNaoPodeRedefinir() {
        assertThrows(AccessDeniedException.class,
                () -> service.redefinirSenha(2, usuario(1, "OPERADOR", StatusAcesso.APROVADO), "ip"));
        verify(usuarios, never()).save(any());
    }

    @Test
    void credencialExpiradaOuReutilizadaEhRejeitada() {
        Usuario alvo = usuario(2, "OPERADOR", StatusAcesso.APROVADO);
        alvo.setTrocaSenhaObrigatoria(true);
        alvo.setCredencialTemporariaHash("hash");
        alvo.setCredencialTemporariaExpiraEm(Instant.now().minusSeconds(1));
        when(usuarios.findByIdForUpdate(2)).thenReturn(Optional.of(alvo));
        assertThrows(IllegalStateException.class, () -> service.consumirCredencialTemporaria(2));

        alvo.setCredencialTemporariaExpiraEm(Instant.now().plusSeconds(60));
        alvo.setCredencialTemporariaUsadaEm(Instant.now());
        assertThrows(IllegalStateException.class, () -> service.consumirCredencialTemporaria(2));
    }

    @Test
    void trocaDefinitivaConfirmaSenhaLimpaTemporariaEInvalidaJwt() {
        Usuario alvo = usuario(2, "OPERADOR", StatusAcesso.APROVADO);
        alvo.setCredentialVersion(4L);
        alvo.setTrocaSenhaObrigatoria(true);
        alvo.setCredencialTemporariaHash(encoder.encode("temporaria"));
        alvo.setCredencialTemporariaExpiraEm(Instant.now().plusSeconds(60));
        alvo.setCredencialTemporariaUsadaEm(Instant.now());
        when(usuarios.findByIdForUpdate(2)).thenReturn(Optional.of(alvo));

        assertThrows(IllegalArgumentException.class,
                () -> service.alterarSenhaObrigatoria(2, "nova123", "outra123", "ip"));
        service.alterarSenhaObrigatoria(2, "nova123", "nova123", "ip");

        assertTrue(encoder.matches("nova123", alvo.getSenhaHash()));
        assertFalse(alvo.getTrocaSenhaObrigatoria());
        assertNull(alvo.getCredencialTemporariaHash());
        assertEquals(5L, alvo.getCredentialVersion());
        CustomUserDetails details = new CustomUserDetails(alvo, List.of());
        assertEquals(alvo.getSenhaHash(), details.getPassword());
    }

    private static Usuario usuario(int id, String perfilNome, StatusAcesso status) {
        Perfil perfil = new Perfil();
        perfil.setNome(perfilNome);
        Usuario usuario = new Usuario();
        usuario.setId(id);
        usuario.setEmail("u" + id + "@teste.local");
        usuario.setNome("Usuário " + id);
        usuario.setSenhaHash("hash");
        usuario.setIdPerfil(perfil);
        usuario.setStatusAcesso(status);
        usuario.setAtivo(status == StatusAcesso.APROVADO);
        return usuario;
    }
}
