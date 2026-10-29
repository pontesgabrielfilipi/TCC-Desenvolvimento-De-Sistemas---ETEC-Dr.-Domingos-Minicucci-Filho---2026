// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.security.jwt;

import jakarta.validation.Validation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import java.util.UUID;

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
        String[] segmentos = token.split("\\.");
        char primeiroCaractere = segmentos[1].charAt(0);
        segmentos[1] = (primeiroCaractere == 'a' ? "b" : "a") + segmentos[1].substring(1);
        String tokenAdulterado = String.join(".", segmentos);

        assertFalse(jwtTokenProvider.validateToken(tokenAdulterado));
    }

    @Test
    void jwtNovoContemSidELegadoNaoGanhaSessaoImplicita() {
        UUID id = UUID.randomUUID();
        var auth = new UsernamePasswordAuthenticationToken("usuario@agerp.com", null);
        var newToken = jwtTokenProvider.generateToken(auth, id);
        assertEquals(id, jwtTokenProvider.getSessionId(newToken));
        assertEquals(null, jwtTokenProvider.getSessionId(jwtTokenProvider.generateToken(auth)));
    }

    @Test
    void configuracaoRejeitaSegredoAusenteOuCurtoEExpiracaoInvalida() {
        JwtProperties properties = new JwtProperties();
        properties.setSecret("curto");
        properties.setExpiration(0);

        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var violations = factory.getValidator().validate(properties);
            assertEquals(2, violations.size());
            assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("secret")));
            assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("expiration")));
        }
    }
}
