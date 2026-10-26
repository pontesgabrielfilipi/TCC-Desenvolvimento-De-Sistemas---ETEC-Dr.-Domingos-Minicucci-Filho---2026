package com.agerp.agerp.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class AuditContextFilter extends OncePerRequestFilter {
    private final ClientIpResolver resolver;

    public AuditContextFilter(ClientIpResolver resolver) { this.resolver = resolver; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        UUID requestId = UUID.randomUUID();
        String provided = request.getHeader("X-Correlation-ID");
        String correlation = provided != null && provided.length() <= 64
                && provided.matches("[A-Za-z0-9_-]{1,64}") ? provided : requestId.toString();
        String agent = clean(request.getHeader("User-Agent"), 256);
        String route = route(request.getRequestURI());
        AuditRequestContext snapshot = new AuditRequestContext(requestId, correlation,
                clean(request.getRemoteAddr(), 50), resolver.resolve(request), agent,
                clean(request.getMethod(), 10), route);
        AuditRequestContext previous = AuditRequestContext.current();
        String previousMdc = MDC.get("requestId");
        try {
            AuditRequestContext.set(snapshot);
            MDC.put("requestId", requestId.toString());
            response.setHeader("X-Request-ID", requestId.toString());
            chain.doFilter(request, response);
        } finally {
            if (previous == null) AuditRequestContext.clear(); else AuditRequestContext.set(previous);
            if (previousMdc == null) MDC.remove("requestId"); else MDC.put("requestId", previousMdc);
        }
    }

    static String route(String uri) {
        if (uri == null) return null;
        int query = uri.indexOf('?');
        if (query >= 0) uri = uri.substring(0, query);
        // Replace resource identifiers, UUIDs and unknown long/path segments.
        String normalized = uri.replaceAll("/[0-9]+(?=/|$)", "/{id}")
                .replaceAll("/[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}(?=/|$)", "/{id}");
        return clean(normalized, 160);
    }

    static String clean(String value, int max) {
        if (value == null) return null;
        String normalized = value.replaceAll("[\\p{Cntrl}]", " ");
        return normalized.substring(0, Math.min(max, normalized.length()));
    }
}
