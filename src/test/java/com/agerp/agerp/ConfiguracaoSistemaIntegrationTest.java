package com.agerp.agerp;

import com.agerp.agerp.dto.ConfiguracaoSistemaRequest;
import com.agerp.agerp.repository.UsuarioRepository;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.service.ConfiguracaoSistemaService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "agerp.seed.enabled=true")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ConfiguracaoSistemaIntegrationTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private ConfiguracaoSistemaService configuracoes;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private MockMvc mvc;

    @Test
    void flywayDisponibilizaDefaultsPersistidos() {
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM agerp.configuracao_sistema", Integer.class));
        var config = configuracoes.consultar();
        assertEquals("AGERP", config.nomeEmpresa());
        assertEquals(15, config.limiteEstoqueBaixo());
        assertTrue(config.exibirAlertasEstoque());
        assertEquals(2000, config.timeoutIaMs());
    }

    @Test
    void leituraDeConfiguracoesAfetaServicoSemReiniciar() {
        jdbc.update("UPDATE agerp.configuracao_sistema SET limite_estoque_baixo=9, timeout_ia_ms=3200 WHERE id=1");
        assertEquals(9, configuracoes.limiteEstoqueBaixo());
        assertEquals(3200, configuracoes.timeoutIaMs());
    }

    @Test
    void alteracaoTransacionalPersisteVersaoEAuditoriaSemExporSegredos() {
        var admin = usuarios.findAll().stream()
                .filter(u -> "ADMIN".equalsIgnoreCase(u.getIdPerfil().getNome()))
                .findFirst().orElseThrow();
        var anterior = configuracoes.consultar();

        var resultado = configuracoes.atualizar(new ConfiguracaoSistemaRequest(
                "Empresa Teste", 8, false, 3500, anterior.versao()), admin, "127.0.0.1");

        assertEquals(anterior.versao() + 1, resultado.versao());
        assertEquals("Empresa Teste", jdbc.queryForObject(
                "SELECT nome_empresa FROM agerp.configuracao_sistema WHERE id=1", String.class));
        assertEquals(8, configuracoes.limiteEstoqueBaixo());
        assertEquals(3500, configuracoes.timeoutIaMs());
        assertEquals(1, jdbc.queryForObject("""
                SELECT COUNT(*) FROM agerp.log_sistema
                WHERE acao='ALTERACAO_CONFIGURACOES' AND entidade='CONFIGURACAO'
                  AND recurso_id='1' AND usuario_email=? AND resultado='SUCESSO'
                """, Integer.class, admin.getEmail()));
    }

    @Test
    void operadorNaoPodeConsultarConfiguracoesAdministrativas() throws Exception {
        mvc.perform(get("/api/admin/configuracoes").with(user("operador").roles("OPERADOR")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/configuracoes").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nomeEmpresa").value("AGERP"));
    }

    @Test
    void configuracaoPublicaSoExpõePreferenciasDeAparencia() throws Exception {
        mvc.perform(get("/api/configuracoes/aparencia").with(user("operador").roles("OPERADOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nomeEmpresa").value("AGERP"))
                .andExpect(jsonPath("$.timeoutIaMs").doesNotExist())
                .andExpect(jsonPath("$.versao").doesNotExist());
    }

    @Test
    void putInvalidoRetorna400EOperadorRecebe403() throws Exception {
        String corpoInvalido = """
                {"nomeEmpresa":"  ","limiteEstoqueBaixo":0,"exibirAlertasEstoque":true,"timeoutIaMs":100,"versao":0}
                """;
        mvc.perform(put("/api/admin/configuracoes")
                        .with(user("admin").roles("ADMIN"))
                        .contentType("application/json").content(corpoInvalido))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/admin/configuracoes")
                        .with(user("operador").roles("OPERADOR"))
                        .contentType("application/json").content(corpoInvalido))
                .andExpect(status().isForbidden());
    }

    @Test
    void versaoObsoletaRetorna409NoEndpointSemAlterarRegistro() throws Exception {
        var admin = usuarios.findAll().stream()
                .filter(u -> "ADMIN".equalsIgnoreCase(u.getIdPerfil().getNome()))
                .findFirst().orElseThrow();
        var config = configuracoes.consultar();
        String corpo = """
                {"nomeEmpresa":"Nao deve salvar","limiteEstoqueBaixo":9,
                 "exibirAlertasEstoque":false,"timeoutIaMs":3000,"versao":%d}
                """.formatted(config.versao() + 1);

        mvc.perform(put("/api/admin/configuracoes")
                        .with(user(new CustomUserDetails(admin,
                                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")))))
                        .contentType("application/json").content(corpo))
                .andExpect(status().isConflict());
        assertEquals(config.nomeEmpresa(), jdbc.queryForObject(
                "SELECT nome_empresa FROM agerp.configuracao_sistema WHERE id=1", String.class));
    }
}
