// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp;

import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.security.CustomUserDetailsService;
import com.agerp.agerp.security.jwt.JwtTokenProvider;
import com.agerp.agerp.service.SessaoAutenticacaoService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Exercita o executor real de StreamingResponseBody do Spring MVC, não um pool criado pelo teste. */
@SpringBootTest(properties = "spring.flyway.placeholders.auditAppRole=test")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ExportacaoAsyncHttpIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired CustomUserDetailsService usuarios;
    @Autowired JwtTokenProvider tokens;
    @Autowired SessaoAutenticacaoService sessoes;
    @Autowired @Qualifier("exportacaoMvcExecutor") ThreadPoolTaskExecutor executor;

    @Test
    void saturacaoHttpRejeitaCom503ELiberaRecursosParaNovaExportacao() throws Exception {
        jdbc.execute("TRUNCATE TABLE agerp.perfil, agerp.cliente, agerp.produto RESTART IDENTITY CASCADE");
        jdbc.update("INSERT INTO agerp.perfil(id_perfil,nome,nivel_autoridade,protegido) VALUES (1,'ADMIN',100,true)");
        jdbc.update("INSERT INTO agerp.usuario(id_usuario,nome,email,senha_hash,ativo,id_perfil,status_acesso) "
                + "VALUES (1,'Admin','async-http@local.test','hash',true,1,'APROVADO')");
        CustomUserDetails details = (CustomUserDetails) usuarios.loadUserByUsername("async-http@local.test");
        var auth = new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities());
        var session = sessoes.criar(details.getUsuario(), null, 86_400_000);
        Cookie cookie = new Cookie("jwtToken", tokens.generateToken(auth, session.getId()));

        // Configuração sob teste: core=2, máximo=4, fila=8 e AbortPolicy.
        assertEquals(4, executor.getMaxPoolSize());
        assertEquals(8, executor.getThreadPoolExecutor().getQueue().remainingCapacity());
        var started = new CountDownLatch(4);
        var release = new CountDownLatch(1);
        try {
            for (int i = 0; i < 12; i++) {
                executor.execute(() -> {
                    started.countDown();
                    try { release.await(25, TimeUnit.SECONDS); }
                    catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
                });
            }
            assertTrue(started.await(5, TimeUnit.SECONDS));
            assertEquals(8, executor.getThreadPoolExecutor().getQueue().size());

            mvc.perform(get("/api/admin/relatorios/clientes_tipo/xlsx").cookie(cookie))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Tente novamente")));
        } finally {
            release.countDown();
        }
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while ((executor.getActiveCount() != 0 || !executor.getThreadPoolExecutor().getQueue().isEmpty())
                && System.nanoTime() < deadline) Thread.sleep(20);
        assertEquals(0, executor.getActiveCount());
        assertEquals(0, executor.getThreadPoolExecutor().getQueue().size());

        MvcResult pending = mvc.perform(get("/api/admin/relatorios/clientes_tipo/xlsx").cookie(cookie))
                .andExpect(request().asyncStarted()).andReturn();
        pending.getAsyncResult(30_000);
        mvc.perform(asyncDispatch(pending)).andExpect(status().isOk());
    }
}
