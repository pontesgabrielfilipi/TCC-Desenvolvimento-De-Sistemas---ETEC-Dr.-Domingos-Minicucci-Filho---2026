// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.config;

import com.agerp.agerp.security.CustomUserDetailsService;
import com.agerp.agerp.security.jwt.JwtAuthenticationFilter;
import com.agerp.agerp.security.jwt.JwtProperties;
import com.agerp.agerp.security.jwt.JwtTokenProvider;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.security.web.csrf.CsrfToken;

import java.util.Map;

import static org.mockito.Mockito.mock;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringJUnitConfig
@WebAppConfiguration
@ContextConfiguration(classes = HttpSecurityFlowTest.Setup.class)
class HttpSecurityFlowTest {
    @Configuration
    @Import(SecurityConfig.class)
    static class Setup {
        @Bean CustomUserDetailsService users() { return mock(CustomUserDetailsService.class); }
        @Bean JwtTokenProvider tokens() { return mock(JwtTokenProvider.class); }
        @Bean JwtProperties jwtProperties() { return new JwtProperties(); }
        @Bean JwtAuthenticationFilter jwtFilter(JwtTokenProvider provider, CustomUserDetailsService users) {
            return new JwtAuthenticationFilter(provider, users, org.mockito.Mockito.mock(com.agerp.agerp.service.SessaoAutenticacaoService.class),
                    org.mockito.Mockito.mock(com.agerp.agerp.service.AuditFailureService.class),
                    new com.agerp.agerp.security.LoginAttemptLimiter(10, 300));
        }
        @Bean Endpoints endpoints() { return new Endpoints(); }
    }

    @RestController
    static class Endpoints {
        @GetMapping("/api/auth/csrf") String csrf(
                @RequestAttribute(name = "org.springframework.security.web.csrf.CsrfToken") CsrfToken csrf) {
            return csrf.getToken();
        }
        @PostMapping("/api/auth/login") String login() { return "ok"; }
        @GetMapping("/api/admin/export") String export() { return "csv"; }
    }

    @Autowired WebApplicationContext context;
    private MockMvc mvc;

    @BeforeEach void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(SecurityMockMvcConfigurers.springSecurity()).build();
    }

    @Test void csrfNoFluxoRealDoFiltro() throws Exception {
        mvc.perform(post("/api/auth/login")).andExpect(status().isForbidden());
        MockHttpServletResponse bootstrap = mvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse();
        Cookie cookie = bootstrap.getCookie("XSRF-TOKEN");
        org.junit.jupiter.api.Assertions.assertNotNull(cookie);
        mvc.perform(post("/api/auth/login").cookie(cookie).header("X-XSRF-TOKEN", "wrong"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/login").cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue()))
                .andExpect(status().isOk());
    }

    @Test void csrfUsaSecureSomenteNoHttpsConfiavelOuQuandoObrigatorio() throws Exception {
        var local = mvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        var tls = mvc.perform(get("/api/auth/csrf").secure(true))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        org.junit.jupiter.api.Assertions.assertNotNull(local);
        org.junit.jupiter.api.Assertions.assertNotNull(tls);
        org.junit.jupiter.api.Assertions.assertFalse(local.getSecure());
        org.junit.jupiter.api.Assertions.assertTrue(tls.getSecure());
    }

    @Test void corsPreflightEAutorizacaoAdmin() throws Exception {
        mvc.perform(options("/api/auth/login").header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "X-XSRF-TOKEN"))
                .andExpect(status().isOk());
        mvc.perform(options("/api/auth/login").header("Origin", "https://attacker.example")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/export").with(user("operator").roles("OPERADOR")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/export").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk());
    }
}
