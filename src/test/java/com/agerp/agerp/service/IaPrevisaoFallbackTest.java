// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.service;

import com.agerp.agerp.dto.PrevisaoEntregaResponse;
import com.agerp.agerp.entity.Endereco;
import com.agerp.agerp.entity.Entrega;
import com.agerp.agerp.entity.Pedido;
import com.agerp.agerp.repository.EnderecoRepository;
import com.agerp.agerp.repository.EntregaRepository;
import com.agerp.agerp.repository.PedidoRepository;
import com.agerp.agerp.repository.PrevisaoEntregaRepository;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Testa falhas com HTTP real em loopback sem substituir a cobertura E2E do serviço Python. */
class IaPrevisaoFallbackTest {
    private PedidoRepository pedidos;
    private EntregaRepository entregas;
    private PrevisaoEntregaRepository previsoes;
    private ConfiguracaoSistemaService config;
    private AuditoriaNegocioService auditoria;
    private IaPrevisaoService service;

    @BeforeEach
    void setup() {
        pedidos = mock(PedidoRepository.class);
        entregas = mock(EntregaRepository.class);
        previsoes = mock(PrevisaoEntregaRepository.class);
        config = mock(ConfiguracaoSistemaService.class);
        auditoria = mock(AuditoriaNegocioService.class);
        service = new IaPrevisaoService(pedidos, mock(EnderecoRepository.class), entregas, previsoes, config);
        ReflectionTestUtils.setField(service, "auditoriaNegocioService", auditoria);
        when(config.timeoutIaMs()).thenReturn(100);
        Pedido pedido = new Pedido();
        pedido.setId(27);
        pedido.setValorTotal(BigDecimal.valueOf(125));
        Endereco endereco = new Endereco();
        endereco.setCidade("Botucatu");
        endereco.setEstado("SP");
        endereco.setCep("18600000");
        pedido.setIdEndereco(endereco);
        when(pedidos.findById(27)).thenReturn(Optional.of(pedido));
        when(entregas.save(any(Entrega.class))).thenAnswer(invocation -> {
            Entrega saved = invocation.getArgument(0);
            saved.setId(19);
            return saved;
        });
    }

    private void assertFallbackAudited() {
        PrevisaoEntregaResponse response = service.obterOuCalcularPrevisao(27);
        assertEquals("ESTIMATIVA_HEURISTICA", response.getStatus());
        assertEquals(27, response.getIdPedido());
        verify(previsoes).saveAndFlush(any());
        verify(auditoria).registrar(eq("FALLBACK_PREVISAO_IA"), eq("PREVISAO"), eq(27),
                argThat(changes -> changes.containsKey("status")
                        && changes.containsKey("modeloVersao") && changes.containsKey("duracaoMs")
                        && !changes.containsKey("customerCep") && !changes.containsKey("email")));
    }

    @Test
    void unreachablePythonServiceProducesAuditedFallback() {
        ReflectionTestUtils.setField(service, "iaServiceUrl", "http://127.0.0.1:1");
        assertFallbackAudited();
    }

    @Test
    void slowRealHttpResponseTriggersReadTimeoutAndAuditedFallback() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/predict", exchange -> {
            calls.incrementAndGet();
            try {
                Thread.sleep(400);
                exchange.sendResponseHeaders(200, -1);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            } catch (java.io.IOException ignored) {
                // O cliente já excedeu o timeout e fechou o socket.
            } finally {
                exchange.close();
            }
        });
        server.start();
        try {
            ReflectionTestUtils.setField(service, "iaServiceUrl", "http://127.0.0.1:" + server.getAddress().getPort());
            assertFallbackAudited();
            assertEquals(1, calls.get(), "Timeout path must reach the actual delayed HTTP endpoint");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void realHttpInvalidJsonHttpErrorInvalidValuesAndRecoveryAreAudited() throws Exception {
        // O servidor usa um socket TCP real, alternando os cenários sem tocar no
        // container Python nem na rede do Compose principal.
        AtomicInteger chamadas = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/predict", exchange -> {
            int tentativa = chamadas.getAndIncrement();
            int status = tentativa == 0 ? 503 : 200;
            String corpo = switch (tentativa) {
                case 0 -> "{\"detail\":\"temporarily unavailable\"}";
                case 1 -> "{not valid json";
                case 2 -> "{\"status\":\"ok\"}";
                case 3 -> "{\"prazo_entrega\":{\"min_dias\":-2,\"max_dias\":1,\"estimativa_central\":1}}";
                case 4 -> "{\"prazo_entrega\":{\"min_dias\":3,\"max_dias\":370,\"estimativa_central\":4}}";
                default -> "{\"prazo_entrega\":{\"min_dias\":2,\"max_dias\":5,\"estimativa_central\":3.5}}";
            };
            byte[] dados = corpo.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            try {
                exchange.sendResponseHeaders(status, dados.length);
                try (var output = exchange.getResponseBody()) { output.write(dados); }
            } finally { exchange.close(); }
        });
        server.start();
        try {
            when(config.timeoutIaMs()).thenReturn(500);
            ReflectionTestUtils.setField(service, "iaServiceUrl", "http://127.0.0.1:" + server.getAddress().getPort());
            for (int cenario = 0; cenario < 5; cenario++) {
                assertFallbackAudited();
                clearInvocations(auditoria, previsoes);
            }
            var recuperacao = service.obterOuCalcularPrevisao(27);
            assertEquals("SUCESSO", recuperacao.getStatus());
            assertEquals(2, recuperacao.getPrazoMinimoDias());
            assertEquals(5, recuperacao.getPrazoMaximoDias());
            assertEquals(3.5, recuperacao.getEstimativaCentralDias());
            verify(auditoria).registrar(eq("CALCULO_PREVISAO_IA"), eq("PREVISAO"), eq(27), anyMap());
            verify(auditoria, never()).registrar(eq("FALLBACK_PREVISAO_IA"), anyString(), anyInt(), anyMap());
            assertEquals(6, chamadas.get());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void mandatoryAuditFailureIsNotSwallowedByFallback() {
        ReflectionTestUtils.setField(service, "iaServiceUrl", "http://127.0.0.1:1");
        doThrow(new IllegalStateException("audit unavailable")).when(auditoria)
                .registrar(anyString(), anyString(), anyInt(), anyMap());
        assertThrows(IllegalStateException.class, () -> service.obterOuCalcularPrevisao(27));
    }
}
