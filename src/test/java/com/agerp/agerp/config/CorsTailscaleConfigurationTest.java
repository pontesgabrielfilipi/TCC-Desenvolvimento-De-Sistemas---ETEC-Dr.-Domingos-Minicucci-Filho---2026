// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.config;

import com.agerp.agerp.security.CustomUserDetailsService;
import com.agerp.agerp.security.jwt.JwtAuthenticationFilter;
import com.agerp.agerp.security.jwt.JwtProperties;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;

class CorsTailscaleConfigurationTest {

    private static final String TAILSCALE_ORIGIN = "https://noname.tailf69801.ts.net";

    @Test
    void springSecurityPermiteSomenteODominioTailscaleConfigurado() {
        SecurityConfig security = new SecurityConfig(
                mock(CustomUserDetailsService.class), mock(JwtAuthenticationFilter.class),
                mock(JwtProperties.class), TAILSCALE_ORIGIN);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        CorsConfiguration cors = security.corsConfigurationSource().getCorsConfiguration(request);

        assertNotNull(cors);
        assertEquals(TAILSCALE_ORIGIN, cors.checkOrigin(TAILSCALE_ORIGIN));
        assertNull(cors.checkOrigin("https://dominio-nao-autorizado.example"));
    }
}
