package com.agerp.agerp;

import com.agerp.agerp.dto.PerfilSaveRequest;
import com.agerp.agerp.dto.UsuarioUpdateRequest;
import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.entity.StatusAcesso;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.PerfilRepository;
import com.agerp.agerp.repository.UsuarioRepository;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.service.PerfilService;
import com.agerp.agerp.service.UsuarioService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/** As escritas concorrentes ocorrem apenas no PostgreSQL descartável do Testcontainers. */
@SpringBootTest(properties = "agerp.seed.enabled=true")
@Import(TestcontainersConfiguration.class)
class UsuarioPerfilAuditoriaConcorrenciaIntegrationTest {
    @Autowired private UsuarioService usuariosService;
    @Autowired private PerfilService perfisService;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private PerfilRepository perfis;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlatformTransactionManager txManager;

    private record Fixture(Usuario admin, Integer operadorPerfilId, Integer targetId, String email) {}

    private Fixture usuarioFixture() {
        return new TransactionTemplate(txManager).execute(tx -> {
            Usuario admin = usuarios.findAll().stream()
                    .filter(u -> "ADMIN".equalsIgnoreCase(u.getIdPerfil().getNome()))
                    .findFirst().orElseThrow();
            assertEquals(100, admin.getIdPerfil().getNivelAutoridade());
            Perfil operador = perfis.findByNome("OPERADOR").orElseThrow();
            String email = "concorrencia-" + UUID.randomUUID() + "@example.invalid";
            Usuario target = new Usuario();
            target.setNome("Operador isolado");
            target.setEmail(email);
            target.setSenhaHash("inutilizavel-em-homologacao");
            target.setStatusAcesso(StatusAcesso.PENDENTE);
            target.setAtivo(false);
            target.setIdPerfil(operador);
            target = usuarios.saveAndFlush(target);
            return new Fixture(admin, operador.getId(), target.getId(), email);
        });
    }

    @Test
    void concurrentUserApprovalAndMetadataEditPreserveBothCommitsAndAudit() throws Exception {
        Fixture fixture = usuarioFixture();
        String editedName = "Operador isolado editado";
        String updatedEmail = "editado-" + fixture.email();
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var approve = executor.submit(() -> {
                assertTrue(start.await(10, TimeUnit.SECONDS));
                return usuariosService.alterarStatus(fixture.targetId(), StatusAcesso.APROVADO,
                        fixture.admin(), "127.0.0.1");
            });
            var edit = executor.submit(() -> {
                assertTrue(start.await(10, TimeUnit.SECONDS));
                UsuarioUpdateRequest request = new UsuarioUpdateRequest();
                request.setNome(editedName);
                request.setEmail(updatedEmail);
                request.setIdPerfil(fixture.operadorPerfilId());
                return usuariosService.atualizar(fixture.targetId(), request,
                        fixture.admin(), "127.0.0.1");
            });
            start.countDown();
            assertNotNull(approve.get(40, TimeUnit.SECONDS));
            assertNotNull(edit.get(40, TimeUnit.SECONDS));
        }
        Usuario actual = new TransactionTemplate(txManager).execute(tx ->
                usuarios.findByIdForUpdate(fixture.targetId()).orElseThrow());
        assertEquals(StatusAcesso.APROVADO, actual.getStatusAcesso());
        assertTrue(actual.getAtivo());
        assertEquals(editedName, actual.getNome());
        assertEquals(updatedEmail, actual.getEmail());
        assertEquals(1L, actual.getCredentialVersion());
        String resource = fixture.targetId().toString();
        assertEquals(1, count("APROVACAO_USUARIO_" + resource, resource));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM agerp.log_sistema "
                + "WHERE entidade='USUARIO' AND recurso_id=? AND acao LIKE 'EDICAO_USUARIO_%'",
                Integer.class, resource));
        List<String> details = jdbc.queryForList("SELECT changes_json::text FROM agerp.log_sistema "
                + "WHERE entidade='USUARIO' AND recurso_id=?", String.class, resource);
        assertEquals(2, details.size());
        assertTrue(details.stream().noneMatch(value -> value != null
                && (value.contains(updatedEmail) || value.contains(editedName))),
                "Audit changes must never contain user email or full name");
    }

    @Test
    void concurrentProfileEditsRejectStaleVersionWithoutExtraAudit() throws Exception {
        var fixture = new TransactionTemplate(txManager).execute(tx -> {
            Usuario admin = usuarios.findAll().stream()
                    .filter(u -> "ADMIN".equalsIgnoreCase(u.getIdPerfil().getNome()))
                    .findFirst().orElseThrow();
            assertEquals(100, admin.getIdPerfil().getNivelAutoridade());
            Perfil profile = new Perfil();
            profile.setNome("CONCORRENCIA_" + UUID.randomUUID().toString().replace("-", "").toUpperCase());
            profile.setNivelAutoridade(20);
            profile.getPaginas().add("PEDIDOS");
            profile = perfis.saveAndFlush(profile);
            return new Object[] { admin, profile.getId(), profile.getNome(), profile.getVersao() };
        });
        Usuario admin = (Usuario) fixture[0];
        int id = (Integer) fixture[1];
        String name = (String) fixture[2];
        long version = (Long) fixture[3];
        CountDownLatch start = new CountDownLatch(1);
        boolean firstSucceeded;
        boolean secondSucceeded;
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> editProfile(admin, id, name, version, 41, start));
            var second = executor.submit(() -> editProfile(admin, id, name, version, 42, start));
            start.countDown();
            firstSucceeded = first.get(40, TimeUnit.SECONDS);
            secondSucceeded = second.get(40, TimeUnit.SECONDS);
        }
        assertNotEquals(firstSucceeded, secondSucceeded,
                "Stale profile updates must conflict instead of silently overwriting another admin");
        Perfil saved = new TransactionTemplate(txManager).execute(tx -> perfis.findById(id).orElseThrow());
        assertEquals(firstSucceeded ? 41 : 42, saved.getNivelAutoridade());
        assertEquals(version + 1, saved.getVersao());
        assertEquals(1, count("EDICAO_PERFIL", String.valueOf(id)),
                "Only the winning transaction may persist an audit event");
    }

    @Test
    void concurrentAdminBlockingMustNotRemoveEveryApprovedAdministrator() throws Exception {
        Object[] admins = new TransactionTemplate(txManager).execute(tx -> {
            Usuario original = usuarios.findAll().stream()
                    .filter(u -> u.getStatusAcesso() == StatusAcesso.APROVADO
                            && "ADMIN".equalsIgnoreCase(u.getIdPerfil().getNome()))
                    .findFirst().orElseThrow();
            assertEquals(1L, usuarios.countByStatusAcessoAndIdPerfilNome(StatusAcesso.APROVADO, "ADMIN"),
                    "Test fixture requires exactly one preexisting administrator");
            Usuario second = new Usuario();
            second.setNome("Administrador de concorrencia");
            second.setEmail("admin-concorrencia-" + UUID.randomUUID() + "@example.invalid");
            second.setSenhaHash("inutilizavel-em-homologacao");
            second.setStatusAcesso(StatusAcesso.APROVADO);
            second.setAtivo(true);
            second.setIdPerfil(original.getIdPerfil());
            second = usuarios.saveAndFlush(second);
            return new Object[] { original, second };
        });
        Usuario first = (Usuario) admins[0];
        Usuario second = (Usuario) admins[1];
        CountDownLatch start = new CountDownLatch(1);
        boolean firstSucceeded;
        boolean secondSucceeded;
        try (var executor = Executors.newFixedThreadPool(2)) {
            var blockSecond = executor.submit(() -> blockAdmin(first, second.getId(), start));
            var blockFirst = executor.submit(() -> blockAdmin(second, first.getId(), start));
            start.countDown();
            firstSucceeded = blockSecond.get(40, TimeUnit.SECONDS);
            secondSucceeded = blockFirst.get(40, TimeUnit.SECONDS);
        }
        assertNotEquals(firstSucceeded, secondSucceeded,
                "Exactly one mutually exclusive admin-blocking transaction must be accepted");
        assertEquals(1L, usuarios.countByStatusAcessoAndIdPerfilNome(StatusAcesso.APROVADO, "ADMIN"),
                "Concurrent requests must not disable the last approved administrator");
        assertEquals(firstSucceeded ? 1 : 0,
                count("BLOQUEIO_USUARIO_" + second.getId(), String.valueOf(second.getId())));
        assertEquals(secondSucceeded ? 1 : 0,
                count("BLOQUEIO_USUARIO_" + first.getId(), String.valueOf(first.getId())));
    }

    private boolean blockAdmin(Usuario actor, int targetId, CountDownLatch start)
            throws InterruptedException {
        assertTrue(start.await(10, TimeUnit.SECONDS));
        try {
            usuariosService.alterarStatus(targetId, StatusAcesso.BLOQUEADO, actor, "127.0.0.1");
            return true;
        } catch (IllegalArgumentException expectedLastAdminRejection) {
            assertTrue(expectedLastAdminRejection.getMessage().contains("último administrador"));
            return false;
        }
    }

    private boolean editProfile(Usuario admin, int id, String name, long version, int level,
            CountDownLatch start) throws InterruptedException {
        assertTrue(start.await(10, TimeUnit.SECONDS));
        CustomUserDetails principal = new CustomUserDetails(admin,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        try {
            perfisService.editar(id, new PerfilSaveRequest(name, "Teste isolado", level,
                    Set.of("PEDIDOS"), version));
            return true;
        } catch (ResponseStatusException conflict) {
            assertEquals(HttpStatus.CONFLICT, conflict.getStatusCode());
            return false;
        } catch (OptimisticLockingFailureException conflict) {
            return false;
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private int count(String action, String resource) {
        return jdbc.queryForObject("SELECT count(*) FROM agerp.log_sistema WHERE acao=? AND recurso_id=?",
                Integer.class, action, resource);
    }
}
