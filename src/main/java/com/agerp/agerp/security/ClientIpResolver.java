package com.agerp.agerp.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@Component
public class ClientIpResolver {

    private final Set<String> trustedProxies;

    public ClientIpResolver(@Value("${agerp.security.trusted-proxies:}") String proxies) {
        trustedProxies = new HashSet<>();
        Arrays.stream(proxies.split(",")).map(String::trim).filter(s -> !s.isEmpty()).forEach(trustedProxies::add);
    }

    public String resolve(HttpServletRequest request) {
        String remote = normalizar(request.getRemoteAddr());
        if (trustedProxies.contains(remote)) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null) {
                String candidate = normalizar(forwarded.split(",", 2)[0]);
                if (ipValido(candidate)) return candidate;
            }
        }
        return ipValido(remote) ? remote : "0.0.0.0";
    }

    private static String normalizar(String ip) { return ip == null ? "" : ip.trim(); }

    private static boolean ipValido(String ip) {
        if (ip.isBlank() || ip.length() > 45 || ip.contains("%")) return false;
        // Evita nomes, controles e valores compostos; aceita somente a sintaxe textual de IPv4/IPv6.
        return ip.matches("[0-9a-fA-F:.]+");
    }
}
