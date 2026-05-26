package com.agerp.agerp.config;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class CacheHeaderFilter implements Filter {

    @Override
    public void doFilter(jakarta.servlet.ServletRequest req, jakarta.servlet.ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        HttpServletResponse response = (HttpServletResponse) res;
        HttpServletRequest request = (HttpServletRequest) req;

        String path = request.getRequestURI();

        if (path.startsWith("/api/admin/logs") ||
                path.startsWith("/api/usuarios") ||
                path.startsWith("/api/clientes")) {

            // Cache de 5 minutos para endpoints de listagem
            response.setHeader("Cache-Control", "public, max-age=300"); // 5 minutos
        } else if (path.startsWith("/api/auth/me")) {
            // Cache curto para dados do usuário logado
            response.setHeader("Cache-Control", "private, max-age=60"); // 1 minuto
        } else {
            // Sem cache para endpoints sensíveis
            response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }

        chain.doFilter(req, res);
    }
}