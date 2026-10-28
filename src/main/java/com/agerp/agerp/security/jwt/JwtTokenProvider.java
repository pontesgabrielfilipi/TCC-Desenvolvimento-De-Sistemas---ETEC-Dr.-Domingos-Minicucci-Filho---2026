// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.security.jwt;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;
import com.agerp.agerp.security.CustomUserDetails;

@Component
public class JwtTokenProvider {

    private final JwtProperties jwtProperties;

    public JwtTokenProvider(JwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(Authentication authentication) {
        return generateToken(authentication, null);
    }

    public String generateToken(Authentication authentication, UUID sid) {
        String email = authentication.getName();
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtProperties.getExpiration());

        var builder = Jwts.builder()
                .subject(email)
                .issuer(jwtProperties.getIssuer())
                .issuedAt(now)
                .expiration(expiryDate);
        if (sid != null) builder.claim("sid", sid.toString()).id(UUID.randomUUID().toString());
        if (authentication.getPrincipal() instanceof CustomUserDetails custom) {
            builder.claim("credentialVersion", custom.getUsuario().getCredentialVersion())
                    .claim("passwordChangeRequired", Boolean.TRUE.equals(custom.getUsuario().getTrocaSenhaObrigatoria()));
        }
        return builder
                .signWith(getSigningKey())
                .compact();
    }

    public long getCredentialVersion(String token) {
        Number value = parseClaims(token).get("credentialVersion", Number.class);
        return value == null ? -1L : value.longValue();
    }

    public UUID getSessionId(String token) {
        try {
            String sid = parseClaims(token).get("sid", String.class);
            return sid == null ? null : UUID.fromString(sid);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser().verifyWith(getSigningKey()).requireIssuer(jwtProperties.getIssuer())
                .build().parseSignedClaims(token).getPayload();
    }

    public String getEmailFromToken(String token) {
        Claims claims = parseClaims(token);

        return claims.getSubject();
    }

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public String tokenFailureKind(String token) {
        try {
            parseClaims(token);
            return "TOKEN_VALIDO";
        } catch (ExpiredJwtException e) {
            return "TOKEN_EXPIRADO";
        } catch (Exception e) {
            return "TOKEN_INVALIDO";
        }
    }
}
