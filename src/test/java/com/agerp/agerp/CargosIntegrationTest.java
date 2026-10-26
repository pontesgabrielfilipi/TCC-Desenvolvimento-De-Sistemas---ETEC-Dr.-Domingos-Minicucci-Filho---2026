package com.agerp.agerp;

import com.agerp.agerp.repository.PerfilRepository;
import com.agerp.agerp.repository.UsuarioRepository;
import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.entity.StatusAcesso;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.security.CustomUserDetailsService;
import com.agerp.agerp.security.jwt.JwtTokenProvider;
import com.agerp.agerp.service.SessaoAutenticacaoService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import jakarta.servlet.http.Cookie;

import java.util.List;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"agerp.seed.enabled=true", "spring.flyway.placeholders.auditAppRole=test"})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class CargosIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired PerfilRepository perfis;
    @Autowired UsuarioRepository usuarios;
    @Autowired CustomUserDetailsService userDetailsService;
    @Autowired JwtTokenProvider jwtTokenProvider;
    @Autowired SessaoAutenticacaoService sessoes;
    @Autowired JdbcTemplate jdbc;

    @Test
    void flywayPreservaAdminEUsuariosEPreenchePermissoes() {
        assertTrue(perfis.findByNome("ADMIN").orElseThrow().getPaginas().contains("ADMIN"));
        assertTrue(perfis.findByNome("OPERADOR").orElseThrow().getPaginas().contains("PRODUTOS"));
        assertTrue(jdbc.queryForObject("SELECT COUNT(*) FROM agerp.usuario WHERE id_perfil IS NOT NULL", Integer.class) > 0);
        assertEquals(100, perfis.findByNome("ADMIN").orElseThrow().getNivelAutoridade());
    }

    @Test
    void criarCargoPersonalizadoExigeAdminENaoPermiteExcluirPadroes() throws Exception {
        String json = """
            {"nome":"expedicao","descricao":"Expedição","nivelAutoridade":40,"paginas":["PEDIDOS"]}
            """;
        mvc.perform(post("/api/admin/perfis").with(user("operador").roles("OPERADOR"))
                .contentType("application/json").content(json)).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/perfis").with(csrf()).with(adminAutenticado())
                .contentType("application/json").content(json))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.nome").value("EXPEDICAO"))
                .andExpect(jsonPath("$.paginas[0]").value("PEDIDOS"));
        int idAdmin = perfis.findByNome("ADMIN").orElseThrow().getId();
        int idOperador = perfis.findByNome("OPERADOR").orElseThrow().getId();
        mvc.perform(delete("/api/admin/perfis/{id}", idAdmin).with(user("admin").roles("ADMIN")))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/admin/perfis/{id}", idOperador).with(user("admin").roles("ADMIN")))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/admin/perfis/{id}", idAdmin).with(user("admin").roles("ADMIN"))
                .contentType("application/json").content(json)).andExpect(status().isForbidden());
    }

    @Test
    void impedeAcessoDiretoSemPermissaoMesmoQuandoAutenticado() throws Exception {
        var operadorSomenteProdutos = user("logistica").authorities(
                new SimpleGrantedAuthority("ROLE_LOGISTICA"), new SimpleGrantedAuthority("PAGE_PRODUTOS"));
        mvc.perform(get("/api/clientes").with(operadorSomenteProdutos)).andExpect(status().isForbidden());
        mvc.perform(get("/api/dashboard/estatisticas").with(operadorSomenteProdutos)).andExpect(status().isForbidden());
        mvc.perform(get("/api/pedidos").with(operadorSomenteProdutos)).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/perfis").with(operadorSomenteProdutos)).andExpect(status().isForbidden());
        mvc.perform(get("/api/produtos").with(operadorSomenteProdutos)).andExpect(status().isOk());
    }

    @Test
    void cargoPersonalizadoNaoPodeReceberPermissaoAdminOuNivel100() throws Exception {
        mvc.perform(post("/api/admin/perfis").with(csrf()).with(user("admin").roles("ADMIN"))
                        .contentType("application/json")
                        .content("{\"nome\":\"ROOT\",\"nivelAutoridade\":100,\"paginas\":[\"PRODUTOS\"]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/perfis").with(csrf()).with(user("admin").roles("ADMIN"))
                        .contentType("application/json")
                        .content("{\"nome\":\"ROOT\",\"nivelAutoridade\":99,\"paginas\":[\"ADMIN\"]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void atualizacaoConcorrenteEExclusaoDeCargoEmUsoSaoImpedidas() throws Exception {
        var perfil = new Perfil();
        perfil.setNome("EXPEDICAO_CONCORRENCIA");
        perfil.setNivelAutoridade(40);
        perfil.getPaginas().add("PEDIDOS");
        perfil = perfis.saveAndFlush(perfil);
        mvc.perform(put("/api/admin/perfis/{id}", perfil.getId()).with(csrf()).with(user("admin").roles("ADMIN"))
                .contentType("application/json")
                .content("{\"nome\":\"EXPEDICAO_CONCORRENCIA\",\"nivelAutoridade\":40,\"paginas\":[\"PEDIDOS\"],\"versao\":999}"))
                .andExpect(status().isConflict());
        usuarioPersistido("vinculado@agerp.local", perfil);
        mvc.perform(delete("/api/admin/perfis/{id}", perfil.getId()).with(csrf()).with(user("admin").roles("ADMIN")))
                .andExpect(status().isConflict());
    }

    @Test
    void edicaoDeCargoAtualizaPermissoesDoJwtExistenteEmCadaRequisicao() throws Exception {
        var perfil = new Perfil();
        perfil.setNome("EXPEDICAO_SESSAO");
        perfil.setNivelAutoridade(40);
        perfil.getPaginas().add("CLIENTES");
        perfil = perfis.saveAndFlush(perfil);
        Usuario pessoa = usuarioPersistido("sessao-cargos@agerp.local", perfil);
        Cookie cookie = cookieAutenticado(pessoa.getEmail());

        mvc.perform(get("/api/clientes").cookie(cookie)).andExpect(status().isOk());
        mvc.perform(get("/api/produtos").cookie(cookie)).andExpect(status().isForbidden());

        mvc.perform(put("/api/admin/perfis/{id}", perfil.getId()).with(csrf()).with(user("admin").roles("ADMIN"))
                        .contentType("application/json")
                        .content("{\"nome\":\"EXPEDICAO_SESSAO\",\"nivelAutoridade\":40,\"paginas\":[\"PRODUTOS\"],\"versao\":" + perfil.getVersao() + "}"))
                .andExpect(status().isOk());

        mvc.perform(get("/api/clientes").cookie(cookie)).andExpect(status().isForbidden());
        mvc.perform(get("/api/produtos").cookie(cookie)).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paginas[0]").value("PRODUTOS"));
    }

    @Test
    void atribuicaoDeCargoRevogaJwtAnteriorEPreservaNovasPermissoes() throws Exception {
        var perfil = new Perfil();
        perfil.setNome("EXPEDICAO_ATRIBUICAO");
        perfil.setNivelAutoridade(35);
        perfil.getPaginas().add("PEDIDOS");
        perfil = perfis.saveAndFlush(perfil);

        Usuario usuario = usuarioPersistido("reatribuido@agerp.local", perfis.findByNome("OPERADOR").orElseThrow());
        Usuario administrador = usuarioPersistido("admin-atribuicao@agerp.local", perfis.findByNome("ADMIN").orElseThrow());
        Cookie cookieUsuario = cookieAutenticado(usuario.getEmail());
        Cookie cookieAdmin = cookieAutenticado(administrador.getEmail());

        mvc.perform(get("/api/clientes").cookie(cookieUsuario)).andExpect(status().isOk());
        mvc.perform(put("/api/admin/usuarios/{id}", usuario.getId()).with(csrf()).cookie(cookieAdmin)
                        .contentType("application/json")
                        .content("{\"nome\":\"Usuario teste cargos\",\"email\":\"reatribuido@agerp.local\",\"idPerfil\":" + perfil.getId() + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.perfilNome").value("EXPEDICAO_ATRIBUICAO"));

        mvc.perform(get("/api/auth/me").cookie(cookieUsuario)).andExpect(status().isUnauthorized());
        Cookie novoCookie = cookieAutenticado(usuario.getEmail());
        mvc.perform(get("/api/clientes").cookie(novoCookie)).andExpect(status().isForbidden());
        mvc.perform(get("/api/pedidos").cookie(novoCookie)).andExpect(status().isOk());
    }

    private RequestPostProcessor adminAutenticado() {
        Usuario administrador = usuarios.findAll().stream()
                .filter(u -> "ADMIN".equalsIgnoreCase(u.getIdPerfil().getNome()))
                .findFirst().orElseThrow();
        return user(new CustomUserDetails(administrador,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"),
                        new SimpleGrantedAuthority("PAGE_ADMIN"))));
    }

    private Usuario usuarioPersistido(String email, Perfil perfil) {
        var usuario = new Usuario();
        usuario.setNome("Usuario teste cargos");
        usuario.setEmail(email);
        usuario.setSenhaHash("senha-hash-teste");
        usuario.setStatusAcesso(StatusAcesso.APROVADO);
        usuario.setAtivo(true);
        usuario.setIdPerfil(perfil);
        return usuarios.saveAndFlush(usuario);
    }

    private Cookie cookieAutenticado(String email) {
        CustomUserDetails detalhes = (CustomUserDetails) userDetailsService.loadUserByUsername(email);
        var auth = new UsernamePasswordAuthenticationToken(detalhes, null, detalhes.getAuthorities());
        var sessao = sessoes.criar(detalhes.getUsuario(), null, 86_400_000);
        return new Cookie("jwtToken", jwtTokenProvider.generateToken(auth, sessao.getId()));
    }

    @Test
    void nivelNaoSubstituiPaginaENivelBaixoNaoCancelaPedidoPorRotasAlternativas() throws Exception {
        var baixoComPedidos = usuarioComPerfil(40, "PEDIDOS");
        var altoSemPedidos = usuarioComPerfil(80, "PRODUTOS");
        var altoComPedidos = usuarioComPerfil(60, "PEDIDOS");
        mvc.perform(post("/api/pedidos/999999/cancelar").with(baixoComPedidos))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/pedidos/999999/status?status=CANCELADO").with(baixoComPedidos))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/pedidos/999999/status").param("status", " cancelado ").with(baixoComPedidos))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/pedidos/999999/cancelar").with(altoSemPedidos))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/produtos/999999").with(baixoComPedidos))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/pedidos/999999/cancelar").with(csrf()).with(altoComPedidos))
                .andExpect(result -> assertNotEquals(403, result.getResponse().getStatus()));
        mvc.perform(patch("/api/pedidos/999999/status?status=CANCELADO").with(csrf()).with(altoComPedidos))
                .andExpect(result -> assertNotEquals(403, result.getResponse().getStatus()));
    }

    private RequestPostProcessor usuarioComPerfil(int nivel, String pagina) {
        var perfil = new Perfil();
        perfil.setNome("PERSONALIZADO");
        perfil.setNivelAutoridade(nivel);
        var usuario = new Usuario();
        usuario.setEmail("teste@agerp.local");
        usuario.setSenhaHash("teste");
        usuario.setIdPerfil(perfil);
        return user(new CustomUserDetails(usuario, List.of(
                new SimpleGrantedAuthority("ROLE_PERSONALIZADO"),
                new SimpleGrantedAuthority("PAGE_" + pagina))));
    }
}
