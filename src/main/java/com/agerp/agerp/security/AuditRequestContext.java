package com.agerp.agerp.security;

import java.util.UUID;
import org.slf4j.MDC;

/** Snapshot imutável e desacoplado, seguro para tarefas assíncronas e sem referências Servlet ou JPA. */
public record AuditRequestContext(UUID requestId, String correlationId, String peerIp,
                                  String resolvedIp, String userAgent, String method, String route) {
    private static final ThreadLocal<AuditRequestContext> CURRENT = new ThreadLocal<>();

    public static AuditRequestContext current() { return CURRENT.get(); }
    public static void set(AuditRequestContext context) { CURRENT.set(context); }
    public static void clear() { CURRENT.remove(); }
    public static Runnable wrap(Runnable task) {
        AuditRequestContext captured = CURRENT.get();
        var capturedMdc = MDC.getCopyOfContextMap();
        return () -> {
            AuditRequestContext previous = CURRENT.get();
            var previousMdc = MDC.getCopyOfContextMap();
            try {
                if (captured == null) clear(); else set(captured);
                if (capturedMdc == null) MDC.clear(); else MDC.setContextMap(capturedMdc);
                task.run();
            } finally {
                if (previous == null) clear(); else set(previous);
                if (previousMdc == null) MDC.clear(); else MDC.setContextMap(previousMdc);
            }
        };
    }
}
