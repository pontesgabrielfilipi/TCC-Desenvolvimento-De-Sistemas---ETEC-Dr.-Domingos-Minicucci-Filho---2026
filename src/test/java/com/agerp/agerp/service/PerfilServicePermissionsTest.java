package com.agerp.agerp.service;

import com.agerp.agerp.dto.PerfilSaveRequest;
import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.repository.PerfilRepository;
import com.agerp.agerp.repository.UsuarioRepository;
import com.agerp.agerp.security.CustomUserDetailsService;
import com.agerp.agerp.entity.Usuario;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PerfilServicePermissionsTest {
    private PerfilRepository perfis;
    private UsuarioRepository usuarios;
    private PerfilService service;

    @BeforeEach
    void configurar() {
        perfis = mock(PerfilRepository.class);
        usuarios = mock(UsuarioRepository.class);
        service = new PerfilService(perfis);
        service.setUsuarioRepository(usuarios);
        when(perfis.saveAndFlush(any())).thenAnswer(inv -> {
            Perfil p = inv.getArgument(0);
            if (p.getId() == null) p.setId(10);
            if (p.getVersao() == null) p.setVersao(0L);
            return p;
        });
    }

    @Test
    void criaCargoComPaginasEspecificasSemAdmin() {
        var response = service.criarPersonalizado(new PerfilSaveRequest(
                "logistica", "Logística", 35, Set.of("PEDIDOS"), null));
        assertEquals("LOGISTICA", response.getNome());
        assertEquals(Set.of("PEDIDOS"), response.getPaginas());
        assertEquals(35, response.getNivelAutoridade());
        verify(perfis).saveAndFlush(any());
    }

    @Test
    void naoPermiteCriarAdministradoresOuEscalarParaPaginaAdmin() {
        assertThrows(ResponseStatusException.class, () -> service.criarPersonalizado(
                new PerfilSaveRequest("ADMIN", "", 99, Set.of("PEDIDOS"), null)));
        assertThrows(IllegalArgumentException.class, () -> service.criarPersonalizado(
                new PerfilSaveRequest("CUSTOM", "", 99, Set.of("ADMIN"), null)));
        assertThrows(IllegalArgumentException.class, () -> service.criarPersonalizado(
                new PerfilSaveRequest("CUSTOM", "", 100, Set.of("PEDIDOS"), null)));
        verify(perfis, never()).saveAndFlush(any());
    }

    @Test
    void cargosPadraoSaoProtegidosEAdminImutavel() {
        Perfil admin = perfil(1, "ADMIN", true);
        Perfil operador = perfil(2, "OPERADOR", true);
        when(perfis.findById(1)).thenReturn(Optional.of(admin));
        when(perfis.findById(2)).thenReturn(Optional.of(operador));
        assertThrows(ResponseStatusException.class, () -> service.excluir(1));
        assertThrows(ResponseStatusException.class, () -> service.excluir(2));
        assertThrows(ResponseStatusException.class, () -> service.editar(1,
                new PerfilSaveRequest("ADMIN", "", 99, Set.of(), 0L)));
        verify(perfis, never()).delete(any());
    }

    @Test
    void cargoEmUsoNaoPodeSerExcluidoEMudancaConcorrenteEhRejeitada() {
        Perfil personalizado = perfil(10, "LOGISTICA", false);
        when(perfis.findById(10)).thenReturn(Optional.of(personalizado));
        when(usuarios.countByIdPerfilId(10)).thenReturn(1L);
        assertThrows(ResponseStatusException.class, () -> service.excluir(10));
        assertThrows(ResponseStatusException.class, () -> service.editar(10,
                new PerfilSaveRequest("LOGISTICA", "", 40, Set.of("CLIENTES"), 9L)));
        verify(perfis, never()).delete(any());
    }

    @Test
    void sessoesRecalculamAutoridadesEmCadaConsultaAoRepositorio() {
        Perfil perfil = perfil(10, "LOGISTICA", false);
        perfil.setPaginas(new LinkedHashSet<>(Set.of("PRODUTOS")));
        Usuario usuario = new Usuario();
        usuario.setEmail("exemplo@agerp.com");
        usuario.setSenhaHash("hash");
        usuario.setIdPerfil(perfil);
        when(usuarios.findByEmail("exemplo@agerp.com")).thenReturn(Optional.of(usuario));
        var detalhes = new CustomUserDetailsService(usuarios);
        assertTrue(detalhes.loadUserByUsername("exemplo@agerp.com").getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("PAGE_PRODUTOS")));
        perfil.getPaginas().clear();
        perfil.getPaginas().add("CLIENTES");
        var atualizado = detalhes.loadUserByUsername("exemplo@agerp.com");
        assertTrue(atualizado.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("PAGE_CLIENTES")));
        assertFalse(atualizado.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("PAGE_PRODUTOS")));
        assertFalse(atualizado.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("PAGE_ADMIN")));
    }

    private static Perfil perfil(int id, String nome, boolean protegido) {
        Perfil p = new Perfil();
        p.setId(id);
        p.setNome(nome);
        p.setProtegido(protegido);
        p.setVersao(0L);
        return p;
    }
}
