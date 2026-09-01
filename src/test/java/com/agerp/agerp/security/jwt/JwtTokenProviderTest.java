package com.agerp.agerp.security.jwt;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtTokenProviderTest {

    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void setUp() {
        JwtProperties properties = new JwtProperties();
        properties.setSecret("agerp-secret-key-2026-very-strong-and-long-key-min-256-bits");
        properties.setExpiration(60_000);
        jwtTokenProvider = new JwtTokenProvider(properties);
    }

    @Test
    void deveGerarLerEValidarToken() {
        String token = jwtTokenProvider.generateToken(
                new UsernamePasswordAuthenticationToken("usuario@agerp.com", null));

        assertEquals("usuario@agerp.com", jwtTokenProvider.getEmailFromToken(token));
        assertTrue(jwtTokenProvider.validateToken(token));
    }

    @Test
    void deveRejeitarTokenAdulterado() {
        String token = jwtTokenProvider.generateToken(
                new UsernamePasswordAuthenticationToken("usuario@agerp.com", null));
        String tokenAdulterado = token.substring(0, token.length() - 1) + "x";

        assertFalse(jwtTokenProvider.validateToken(tokenAdulterado));
    }
}
