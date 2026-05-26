package com.agerp.agerp.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * Configuração de Cache para o AGERP
 * Utiliza Caffeine (cache em memória) - leve, rápido e excelente para TCC
 */
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();

        // Configurações globais do cache
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(1000)                    // Máximo de itens armazenados em cache
                .expireAfterWrite(10, TimeUnit.MINUTES) // Expira após 15 minutos sem uso
                .expireAfterAccess(5, TimeUnit.MINUTES) // Expira 10 minutos após último acesso
                .recordStats());                      // Registra estatísticas (hits/misses)

        System.out.println("✅ Cache Caffeine configurado com sucesso!");
        return cacheManager;
    }
}