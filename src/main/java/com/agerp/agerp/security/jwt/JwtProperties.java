// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.security.jwt;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.AssertTrue;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Component
@ConfigurationProperties(prefix = "jwt")
@Validated
@Getter
@Setter
public class JwtProperties {

    @NotBlank
    @Size(min = 32)
    private String secret;

    @Positive
    private long expiration = 86400000; // 24 horas em milissegundos

    @NotBlank
    private String issuer = "agerp";

    private boolean cookieSecure;

    @Pattern(regexp = "Strict|Lax|None")
    private String cookieSameSite = "Strict";

    // Vazio mantém o cookie restrito ao host e impede o compartilhamento entre domínios.
    private String cookieDomain = "";

    @Min(1) @Max(365)
    private int deviceCookieDays = 180;

    @AssertTrue(message = "SameSite=None requer JWT_COOKIE_SECURE=true")
    public boolean isCookiePolicyValid() {
        return !"None".equals(cookieSameSite) || cookieSecure;
    }

}
