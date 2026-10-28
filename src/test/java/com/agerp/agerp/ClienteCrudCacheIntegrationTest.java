// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp;

import com.agerp.agerp.dto.ClienteCreateRequest;
import com.agerp.agerp.service.ClienteService;
import com.agerp.agerp.repository.UsuarioRepository;
import com.agerp.agerp.security.CustomUserDetails;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(properties = "agerp.seed.enabled=true")
@Import(TestcontainersConfiguration.class)
@Transactional
class ClienteCrudCacheIntegrationTest {
    @Autowired private ClienteService clientes;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManager entityManager;
    @Autowired private CacheManager cacheManager;
    @Autowired private UsuarioRepository usuarios;

    @BeforeEach
    void autenticarAtorAuditavel() {
        var admin = usuarios.findAll().stream()
                .filter(u -> "ADMIN".equalsIgnoreCase(u.getIdPerfil().getNome()))
                .findFirst().orElseThrow();
        var details = new CustomUserDetails(admin, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));
    }

    @AfterEach
    void limparCaches() {
        SecurityContextHolder.clearContext();
        cacheManager.getCacheNames().forEach(nome -> {
            var cache = cacheManager.getCache(nome);
            if (cache != null) cache.clear();
        });
    }

    @Test
    void crudPersisteERefreshIgnoraListaObsoleta() {
        var criado = clientes.criar(request("Cliente Cache", "52998224725", "cache@agerp.test"));
        entityManager.flush();
        assertEquals("Cliente Cache", jdbc.queryForObject(
                "SELECT nome_razao FROM agerp.cliente WHERE id_cliente=?", String.class, criado.getId()));

        clientes.listarTodos(); // aquece o Caffeine com o valor original
        jdbc.update("UPDATE agerp.cliente SET nome_razao=? WHERE id_cliente=?", "Cliente Outra Sessao", criado.getId());
        entityManager.clear();

        assertTrue(clientes.listarTodos().stream()
                .anyMatch(cliente -> cliente.getId().equals(criado.getId()) && cliente.getNomeRazao().equals("Cliente Cache")));
        assertTrue(clientes.recarregarTodos().stream()
                .anyMatch(cliente -> cliente.getId().equals(criado.getId()) && cliente.getNomeRazao().equals("Cliente Outra Sessao")));

        clientes.atualizar(criado.getId(), request("Cliente Editado", "52998224725", "cache@agerp.test"));
        entityManager.flush();
        assertEquals("Cliente Editado", jdbc.queryForObject(
                "SELECT nome_razao FROM agerp.cliente WHERE id_cliente=?", String.class, criado.getId()));

        clientes.deletar(criado.getId());
        entityManager.flush();
        assertEquals(0, jdbc.queryForObject(
                "SELECT COUNT(*) FROM agerp.cliente WHERE id_cliente=?", Integer.class, criado.getId()));
    }

    private static ClienteCreateRequest request(String nome, String documento, String email) {
        ClienteCreateRequest request = new ClienteCreateRequest();
        request.setTipo("FISICA");
        request.setNomeRazao(nome);
        request.setCpfCnpj(documento);
        request.setEmail(email);
        request.setTelefone("(14) 99999-0000");
        return request;
    }
}
