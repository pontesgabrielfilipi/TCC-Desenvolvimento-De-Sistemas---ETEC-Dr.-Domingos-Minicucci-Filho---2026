package com.agerp.agerp.security.jwt;

import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.entity.StatusAcesso;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.security.CustomUserDetails;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.*;

class JwtAuthenticationFilterApprovalTest {
    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void jwtAntigoNaoAutenticaUsuarioBloqueado() throws Exception {
        JwtTokenProvider tokens = mock(JwtTokenProvider.class);
        UserDetailsService detailsService = mock(UserDetailsService.class);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(tokens, detailsService);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getRequestURI()).thenReturn("/api/produtos");
        when(request.getCookies()).thenReturn(new Cookie[]{new Cookie("jwtToken", "token-antigo")});
        when(tokens.validateToken("token-antigo")).thenReturn(true);
        when(tokens.getEmailFromToken("token-antigo")).thenReturn("bloqueado@agerp.com");
        when(detailsService.loadUserByUsername("bloqueado@agerp.com"))
                .thenReturn(details(StatusAcesso.BLOQUEADO));

        filter.doFilterInternal(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(chain, times(1)).doFilter(request, response);
    }

    @Test
    void jwtDeVersaoAnteriorNaoAutenticaAposRedefinicao() throws Exception {
        JwtTokenProvider tokens = mock(JwtTokenProvider.class);
        UserDetailsService detailsService = mock(UserDetailsService.class);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(tokens, detailsService);
        HttpServletRequest request = mock(HttpServletRequest.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getRequestURI()).thenReturn("/api/produtos");
        when(request.getCookies()).thenReturn(new Cookie[]{new Cookie("jwtToken", "jwt-v0")});
        when(tokens.validateToken("jwt-v0")).thenReturn(true);
        when(tokens.getEmailFromToken("jwt-v0")).thenReturn("bloqueado@agerp.com");
        when(tokens.getCredentialVersion("jwt-v0")).thenReturn(0L);
        CustomUserDetails details = details(StatusAcesso.APROVADO);
        details.getUsuario().setCredentialVersion(1L);
        when(detailsService.loadUserByUsername(anyString())).thenReturn(details);

        filter.doFilterInternal(request, mock(HttpServletResponse.class), chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(chain).doFilter(any(), any());
    }

    private static CustomUserDetails details(StatusAcesso status) {
        Perfil perfil = new Perfil();
        perfil.setNome("OPERADOR");
        Usuario usuario = new Usuario();
        usuario.setEmail("bloqueado@agerp.com");
        usuario.setSenhaHash("hash");
        usuario.setIdPerfil(perfil);
        usuario.setStatusAcesso(status);
        return new CustomUserDetails(usuario, List.of(new SimpleGrantedAuthority("ROLE_OPERADOR")));
    }
}
