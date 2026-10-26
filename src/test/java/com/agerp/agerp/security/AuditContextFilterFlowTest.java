package com.agerp.agerp.security;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Exercises the actual servlet filters together, including their ordering and cleanup. */
class AuditContextFilterFlowTest {
    @RestController
    static class Probe {
        @GetMapping(value = "/api/auditoria/123", produces = MediaType.TEXT_PLAIN_VALUE)
        String inspect(HttpServletRequest request) {
            AuditRequestContext context = AuditRequestContext.current();
            return context.peerIp() + "|" + context.resolvedIp() + "|"
                    + context.correlationId() + "|" + context.route() + "|" + request.isSecure();
        }
    }

    private MockMvc mvc() {
        var resolver = new ClientIpResolver("10.8.0.0/24");
        return MockMvcBuilders.standaloneSetup(new Probe())
                .addFilters(new TrustedSchemeFilter(resolver), new AuditContextFilter(resolver))
                .build();
    }

    @Test
    void remoteNaoConfiavelNaoPodeForjarIpNemHttpsEContextoELimpo() throws Exception {
        mvc().perform(get("/api/auditoria/123")
                        .with(request -> { request.setRemoteAddr("203.0.113.8"); return request; })
                        .header("X-Forwarded-For", "198.51.100.9")
                        .header("X-Forwarded-Proto", "https")
                        .header("X-Correlation-ID", "request_123"))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Request-ID"))
                .andExpect(content().string("203.0.113.8|203.0.113.8|request_123|/api/auditoria/{id}|false"));
        assertNull(AuditRequestContext.current());
    }

    @Test
    void consideraProxyConfiavelMasParaNoPrimeiroHopNaoConfiavel() throws Exception {
        mvc().perform(get("/api/auditoria/123")
                        .with(request -> { request.setRemoteAddr("10.8.0.2"); return request; })
                        .header("X-Forwarded-For", "198.51.100.9, 10.8.0.3")
                        .header("X-Forwarded-Proto", "https")
                        .header("X-Correlation-ID", "flow_456"))
                .andExpect(status().isOk())
                .andExpect(content().string("10.8.0.2|198.51.100.9|flow_456|/api/auditoria/{id}|true"));
        assertNull(AuditRequestContext.current());
    }

    @Test
    void rejeitaCabecalhosConflitantesNaCadeiaConfiavel() throws Exception {
        mvc().perform(get("/api/auditoria/123")
                        .with(request -> { request.setRemoteAddr("10.8.0.2"); return request; })
                        .header("X-Forwarded-For", "198.51.100.9")
                        .header("Forwarded", "for=192.0.2.5")
                        .header("X-Forwarded-Proto", "http,https")
                        .header("X-Correlation-ID", "../../invalid"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.matchesPattern(
                        "10\\.8\\.0\\.2\\|10\\.8\\.0\\.2\\|[0-9a-f-]{36}\\|/api/auditoria/\\{id\\}\\|false")));
        assertNull(AuditRequestContext.current());
    }
}
