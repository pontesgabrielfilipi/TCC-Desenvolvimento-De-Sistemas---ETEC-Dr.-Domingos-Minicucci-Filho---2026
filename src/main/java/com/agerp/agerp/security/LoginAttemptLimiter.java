package com.agerp.agerp.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Limita falhas pela combinação de origem de rede e conta, sem bloquear a conta em si. */
@Component
public class LoginAttemptLimiter {
    private record Failure(int count, long firstAt) {}
    private final ConcurrentHashMap<String, Failure> failures = new ConcurrentHashMap<>();
    private final int limit;
    private final long windowSeconds;

    public LoginAttemptLimiter(@Value("${agerp.security.login.max-failures:10}") int limit,
                               @Value("${agerp.security.login.window-seconds:300}") long windowSeconds) {
        if (limit < 1 || limit > 1000 || windowSeconds < 1 || windowSeconds > 86400)
            throw new IllegalArgumentException("Limites de login invalidos (tentativas 1..1000; janela 1..86400 s)");
        this.limit = limit;
        this.windowSeconds = windowSeconds;
    }

    private String key(String email, String ip) {
        String value = (email == null ? "" : email.trim().toLowerCase(java.util.Locale.ROOT)) + "|" + ip;
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    public boolean blocked(String email, String ip) {
        Failure f = failures.get(key(email, ip));
        return f != null && Instant.now().getEpochSecond() - f.firstAt < windowSeconds && f.count >= limit;
    }

    public void fail(String email, String ip) {
        long now = Instant.now().getEpochSecond();
        failures.compute(key(email, ip), (k, f) -> f == null || now - f.firstAt >= windowSeconds
                ? new Failure(1, now) : new Failure(Math.min(limit, f.count + 1), f.firstAt));
        if (failures.size() > 50000) failures.clear();
    }

    public void success(String email, String ip) { failures.remove(key(email, ip)); }
}
