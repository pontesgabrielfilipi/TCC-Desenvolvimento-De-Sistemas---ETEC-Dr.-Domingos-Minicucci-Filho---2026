package com.agerp.agerp.security.jwt;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "jwt")
@Getter
@Setter
public class JwtProperties {

    private String secret = "agerp-secret-key-2026-very-strong-and-long-key-min-256-bits";
    private long expiration = 86400000; // 24 horas em milissegundos

}