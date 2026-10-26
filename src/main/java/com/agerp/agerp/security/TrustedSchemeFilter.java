package com.agerp.agerp.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** Reconstruct TLS scheme only from an explicitly trusted socket peer. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TrustedSchemeFilter extends OncePerRequestFilter {
    private final ClientIpResolver resolver;

    public TrustedSchemeFilter(ClientIpResolver resolver) {
        this.resolver = resolver;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // The peer is read before any wrapping; do not override getRemoteAddr().
        boolean trusted = resolver.isTrustedPeer(request.getRemoteAddr());
        var protocols = request.getHeaders("X-Forwarded-Proto");
        if (!trusted || !protocols.hasMoreElements()) {
            chain.doFilter(request, response);
            return;
        }
        String protocol = protocols.nextElement();
        if (protocols.hasMoreElements() || !"https".equalsIgnoreCase(protocol)) {
            chain.doFilter(request, response);
            return;
        }
        chain.doFilter(new HttpServletRequestWrapper(request) {
            @Override public boolean isSecure() { return true; }
            @Override public String getScheme() { return "https"; }
            @Override public int getServerPort() { return 443; }
        }, response);
    }
}
