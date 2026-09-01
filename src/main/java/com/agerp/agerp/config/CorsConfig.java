package com.agerp.agerp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

        CorsConfiguration config = new CorsConfiguration();

        // === ORIGENS PERMITIDAS (só frontend e Python) ===
        config.setAllowedOrigins(Arrays.asList(
                "http://localhost:3000",           // Frontend no Docker (nginx porta 80 → mapeada para 3000)
                "http://localhost:5173",           // Frontend em desenvolvimento (npm run dev)
                "http://127.0.0.1:3000",
                "http://127.0.0.1:5173",
                "http://agerp-frontend:80",        // Nome do serviço no Docker (caso precise chamar internamente)
                "http://localhost:8000"            // Python-IA (se ele fizer chamadas para o backend)
        ));

        // Métodos HTTP permitidos
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));

        // Headers permitidos
        config.setAllowedHeaders(Arrays.asList("*"));

        // Permite credenciais (importante para cookie JWT HttpOnly)
        config.setAllowCredentials(true);

        // Expõe headers necessários no frontend (ex: Authorization se precisar)
        config.setExposedHeaders(List.of("Authorization", "Content-Type"));

        // Tempo de cache da preflight (OPTIONS)
        config.setMaxAge(3600L);

        // Aplica a configuração em todos os endpoints da API
        source.registerCorsConfiguration("/api/**", config);

        return new CorsFilter(source);
    }
}
