package com.agerp.agerp.controller;

import com.agerp.agerp.dto.LoginRequest;
import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.entity.StatusAcesso;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.security.ClientIpResolver;
import com.agerp.agerp.security.jwt.JwtProperties;
import com.agerp.agerp.security.jwt.JwtTokenProvider;
import com.agerp.agerp.service.LogSistemaService;
import com.agerp.agerp.service.UsuarioService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

class AuthControllerApprovalTest {

    private JwtProperties jwtProperties;

    @BeforeEach
    void setUp() {
        jwtProperties = new JwtProperties();
        jwtProperties.setSecret("0123456789abcdef0123456789abcdef");
        jwtProperties.setExpiration(90_001);
    }

    @Test
    void credencialValidaPendenteRecebeRespostaEspecificaSemJwt() {
        AuthenticationManager manager = mock(AuthenticationManager.class);
        JwtTokenProvider tokens = mock(JwtTokenProvider.class);
        AuthController controller = new AuthController(manager, tokens, mock(LogSistemaService.class),
                mock(UsuarioService.class));
        Usuario usuario = usuario(StatusAcesso.PENDENTE);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(new CustomUserDetails(usuario,
                List.of(new SimpleGrantedAuthority("ROLE_OPERADOR"))));
        when(manager.authenticate(any())).thenReturn(authentication);
        LoginRequest login = new LoginRequest();
        login.setEmail(usuario.getEmail());
        login.setSenha("senha-correta");

        var response = controller.login(login, mock(HttpServletRequest.class), mock(HttpServletResponse.class));

        assertEquals(403, response.getStatusCode().value());
        verify(tokens, never()).generateToken(any());
    }

    @Test
    void loginEAcoesDeSaidaUsamCookieSeguroComSameSiteEDuracaoDoJwt() {
        AuthenticationManager manager = mock(AuthenticationManager.class);
        JwtTokenProvider tokens = mock(JwtTokenProvider.class);
        LogSistemaService logs = mock(LogSistemaService.class);
        UsuarioService usuarios = mock(UsuarioService.class);
        jwtProperties.setCookieSecure(true);
        AuthController controller = new AuthController(manager, tokens, logs, usuarios,
                new ClientIpResolver(""), jwtProperties);
        Usuario usuario = usuario(StatusAcesso.APROVADO);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(new CustomUserDetails(usuario,
                List.of(new SimpleGrantedAuthority("ROLE_OPERADOR"))));
        when(manager.authenticate(any())).thenReturn(authentication);
        when(tokens.generateToken(any())).thenReturn("token-assinado");
        LoginRequest login = new LoginRequest();
        login.setEmail(usuario.getEmail());
        login.setSenha("senha-correta");
        MockHttpServletResponse response = new MockHttpServletResponse();

        var loginResponse = controller.login(login, new MockHttpServletRequest(), response);

        assertEquals(200, loginResponse.getStatusCode().value());
        var cookie = response.getCookie("jwtToken");
        assertNotNull(cookie);
        assertTrue(cookie.getSecure());
        assertTrue(cookie.isHttpOnly());
        assertEquals("Strict", cookie.getAttribute("SameSite"));
        assertEquals(91, cookie.getMaxAge());

        MockHttpServletResponse logoutResponse = new MockHttpServletResponse();
        controller.logout(new MockHttpServletRequest(), logoutResponse);
        var removido = logoutResponse.getCookie("jwtToken");
        assertNotNull(removido);
        assertTrue(removido.getSecure());
        assertEquals("Strict", removido.getAttribute("SameSite"));
        assertEquals(0, removido.getMaxAge());
    }

    @Test
    void requisicaoHttpsDoProxyMarcaCookieComoSeguroSemQuebrarHttpLocal() {
        AuthenticationManager manager = mock(AuthenticationManager.class);
        JwtTokenProvider tokens = mock(JwtTokenProvider.class);
        jwtProperties.setCookieSecure(false);
        AuthController controller = new AuthController(manager, tokens, mock(LogSistemaService.class),
                mock(UsuarioService.class), new ClientIpResolver(""), jwtProperties);
        Usuario usuario = usuario(StatusAcesso.APROVADO);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(new CustomUserDetails(usuario,
                List.of(new SimpleGrantedAuthority("ROLE_OPERADOR"))));
        when(manager.authenticate(any())).thenReturn(authentication);
        when(tokens.generateToken(any())).thenReturn("token-assinado");
        LoginRequest login = new LoginRequest();
        login.setEmail(usuario.getEmail());
        login.setSenha("senha-correta");

        MockHttpServletRequest httpsRequest = new MockHttpServletRequest();
        httpsRequest.setSecure(true);
        MockHttpServletResponse httpsResponse = new MockHttpServletResponse();
        controller.login(login, httpsRequest, httpsResponse);
        assertTrue(httpsResponse.getCookie("jwtToken").getSecure());

        MockHttpServletResponse httpResponse = new MockHttpServletResponse();
        controller.login(login, new MockHttpServletRequest(), httpResponse);
        assertEquals(false, httpResponse.getCookie("jwtToken").getSecure());
    }

    private static Usuario usuario(StatusAcesso status) {
        Perfil perfil = new Perfil();
        perfil.setNome("OPERADOR");
        Usuario usuario = new Usuario();
        usuario.setId(2);
        usuario.setNome("Pendente");
        usuario.setEmail("pendente@agerp.com");
        usuario.setSenhaHash("hash");
        usuario.setIdPerfil(perfil);
        usuario.setStatusAcesso(status);
        return usuario;
    }
}
