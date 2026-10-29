// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.security;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class AuditRequestContextTest {
    @Test
    void snapshotAssincronoRestauraContextoAnteriorMesmoComExcecao() {
        var source = new AuditRequestContext(UUID.randomUUID(), "correlacao", "127.0.0.1",
                "127.0.0.1", "browser", "GET", "/api/teste");
        var previous = new AuditRequestContext(UUID.randomUUID(), "outro", null, null, null, null, null);
        try {
            AuditRequestContext.set(source);
            MDC.put("requestId", source.requestId().toString());
            var captured = new AtomicReference<AuditRequestContext>();
            Runnable wrapped = AuditRequestContext.wrap(() -> {
                captured.set(AuditRequestContext.current());
                assertEquals(source.requestId().toString(), MDC.get("requestId"));
                throw new IllegalStateException("falha simulada");
            });
            AuditRequestContext.set(previous);
            MDC.put("requestId", previous.requestId().toString());
            assertThrows(IllegalStateException.class, wrapped::run);
            assertSame(source, captured.get());
            assertSame(previous, AuditRequestContext.current());
            assertEquals(previous.requestId().toString(), MDC.get("requestId"));
        } finally {
            AuditRequestContext.clear();
            MDC.clear();
        }
    }

    @Test
    void rotaRemoveQueryStringEAnonimizaIdentificadorNumerico() {
        assertEquals("/api/usuarios/{id}", AuditContextFilter.route("/api/usuarios/123?senha=nao-salvar"));
    }
}
