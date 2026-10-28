// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/** Define os caches locais e seus limites de retenção. */
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();

        registerCache(cacheManager, "produtosAtivos", 500, 5, TimeUnit.MINUTES);
        registerCache(cacheManager, "produtosTodos", 500, 5, TimeUnit.MINUTES);
        registerCache(cacheManager, "produtoPorId", 1000, 5, TimeUnit.MINUTES);

        registerCache(cacheManager, "clientes", 500, 5, TimeUnit.MINUTES);
        registerCache(cacheManager, "clientePorId", 1000, 5, TimeUnit.MINUTES);

        registerCache(cacheManager, "usuarios", 300, 3, TimeUnit.MINUTES);
        registerCache(cacheManager, "usuariosAtivos", 300, 3, TimeUnit.MINUTES);
        registerCache(cacheManager, "usuarioPorId", 500, 3, TimeUnit.MINUTES);
        registerCache(cacheManager, "usuarioPorEmail", 500, 3, TimeUnit.MINUTES);

        registerCache(cacheManager, "dashboardEstatisticas", 10, 30, TimeUnit.SECONDS);
        registerCache(cacheManager, "dashboardRelatorio", 10, 30, TimeUnit.SECONDS);

        registerCache(cacheManager, "adminEstatisticas", 10, 30, TimeUnit.SECONDS);
        registerCache(cacheManager, "adminRelatorios", 50, 1, TimeUnit.MINUTES);

        registerCache(cacheManager, "pedidos", 500, 2, TimeUnit.MINUTES);
        registerCache(cacheManager, "pedidoPorId", 1000, 2, TimeUnit.MINUTES);
        registerCache(cacheManager, "pedidosPorStatus", 100, 1, TimeUnit.MINUTES);
        registerCache(cacheManager, "pedidosPorCliente", 500, 2, TimeUnit.MINUTES);
        registerCache(cacheManager, "pedidosPrevisaoIa", 500, 10, TimeUnit.MINUTES);

        return cacheManager;
    }

    private void registerCache(CaffeineCacheManager cacheManager, String name, long maximumSize, long ttl,
            TimeUnit timeUnit) {
        Cache<Object, Object> cache = Caffeine.newBuilder()
                .maximumSize(maximumSize)
                .expireAfterWrite(ttl, timeUnit)
                .recordStats()
                .build();

        cacheManager.registerCustomCache(name, cache);
    }
}
