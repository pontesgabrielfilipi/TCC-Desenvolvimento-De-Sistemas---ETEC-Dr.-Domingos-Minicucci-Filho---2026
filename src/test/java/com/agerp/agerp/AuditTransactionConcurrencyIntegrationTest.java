// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp;

import com.agerp.agerp.dto.ClienteCreateRequest;
import com.agerp.agerp.repository.ClienteRepository;
import com.agerp.agerp.repository.EnderecoRepository;
import com.agerp.agerp.repository.LogSistemaRepository;
import com.agerp.agerp.repository.PedidoRepository;
import com.agerp.agerp.repository.UsuarioRepository;
import com.agerp.agerp.security.CustomUserDetails;
import com.agerp.agerp.service.AuditoriaNegocioService;
import com.agerp.agerp.service.ClienteService;
import com.agerp.agerp.service.LogSistemaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Todas as escritas desta classe ocorrem na instância PostgreSQL isolada do Testcontainers. */
@SpringBootTest(properties = "agerp.seed.enabled=true")
@Import(TestcontainersConfiguration.class)
class AuditTransactionConcurrencyIntegrationTest {
    @Autowired private ClienteService clientes;
    @Autowired private ClienteRepository clienteRepo;
    @Autowired private EnderecoRepository enderecoRepo;
    @Autowired private PedidoRepository pedidoRepo;
    @Autowired private LogSistemaRepository logRepo;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private PlatformTransactionManager txManager;
    @Autowired private JdbcTemplate jdbc;

    private CustomUserDetails admin;

    @BeforeEach
    void loadDisposableAdmin() {
        admin = new TransactionTemplate(txManager).execute(status -> {
            var user = usuarios.findAll().stream()
                    .filter(u -> "ADMIN".equalsIgnoreCase(u.getIdPerfil().getNome()))
                    .findFirst().orElseThrow();
            return new CustomUserDetails(user, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        });
        assertNotNull(admin);
    }

    private void auth() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities()));
    }

    private static ClienteCreateRequest request(String suffix) {
        var r = new ClienteCreateRequest();
        r.setNomeRazao("AUDIT TEST " + suffix);
        r.setTipo("FISICA");
        r.setEmail("audit-" + suffix + "@example.invalid");
        return r;
    }

    private int countClients(String email) {
        return jdbc.queryForObject("SELECT count(*) FROM agerp.cliente WHERE email=?", Integer.class, email);
    }

    private int countAudit(int resourceId) {
        return jdbc.queryForObject("SELECT count(*) FROM agerp.log_sistema WHERE acao='CRIACAO_CLIENTE' AND recurso_id=?",
                Integer.class, String.valueOf(resourceId));
    }

    @Test
    void applicationRollbackAlsoRollsBackPersistedAudit() {
        String suffix = UUID.randomUUID().toString();
        String email = request(suffix).getEmail();
        AtomicInteger resourceId = new AtomicInteger();
        auth();
        try {
            assertThrows(IllegalStateException.class, () -> new TransactionTemplate(txManager).executeWithoutResult(status -> {
                resourceId.set(clientes.criar(request(suffix)).getId());
                assertEquals(1, countAudit(resourceId.get()), "Audit must be written within the transaction");
                throw new IllegalStateException("Intentional rollback of disposable business transaction");
            }));
            assertTrue(resourceId.get() > 0);
            assertEquals(0, countClients(email));
            assertEquals(0, countAudit(resourceId.get()), "Rolled-back business action must not leave a success audit");
        } finally { SecurityContextHolder.clearContext(); }
    }

    @Test
    void auditWriteFailurePreventsBusinessCommit() {
        String suffix = UUID.randomUUID().toString();
        String email = request(suffix).getEmail();
        LogSistemaService brokenWriter = mock(LogSistemaService.class);
        AtomicInteger resourceId = new AtomicInteger();
        doAnswer(invocation -> {
            resourceId.set(Integer.parseInt(invocation.getArgument(3)));
            throw new IllegalStateException("Injected audit persistence failure");
        }).when(brokenWriter).registrarEvento(any(), eq("CRIACAO_CLIENTE"), eq("CLIENTE"), anyString(),
                eq("SUCESSO"), isNull(), isNull(), anyMap());

        ClienteService withFailingAudit = new ClienteService(clienteRepo, enderecoRepo, pedidoRepo);
        ReflectionTestUtils.setField(withFailingAudit, "auditoria", new AuditoriaNegocioService(brokenWriter));
        auth();
        try {
            // A transação de negócio é real; a falha é injetada apenas no gravador de auditoria.
            assertThrows(IllegalStateException.class, () -> new TransactionTemplate(txManager).executeWithoutResult(
                    status -> withFailingAudit.criar(request(suffix))));
            verify(brokenWriter, times(1)).registrarEvento(any(), eq("CRIACAO_CLIENTE"), eq("CLIENTE"),
                    anyString(), eq("SUCESSO"), isNull(), isNull(), anyMap());
            assertTrue(resourceId.get() > 0);
            assertEquals(0, countClients(email));
            assertEquals(0, countAudit(resourceId.get()));
        } finally { SecurityContextHolder.clearContext(); }
    }

    @Test
    void actualDatabaseAuditConstraintFailureRollsBackBusinessAndConstraint() {
        String suffix = UUID.randomUUID().toString();
        String email = request(suffix).getEmail();
        int initialAuditCount = jdbc.queryForObject(
                "SELECT count(*) FROM agerp.log_sistema WHERE acao='CRIACAO_CLIENTE'", Integer.class);
        auth();
        try {
            // A CHECK NOT VALID vale para novas escritas mesmo com linhas legadas incompatíveis.
            // Se falhar, o próprio DDL é revertido no PostgreSQL descartável do Testcontainers.
            RuntimeException failure = assertThrows(RuntimeException.class, () -> new TransactionTemplate(txManager).executeWithoutResult(status -> {
                jdbc.execute("ALTER TABLE agerp.log_sistema ADD CONSTRAINT v01_test_reject_client_audit "
                        + "CHECK (acao <> 'CRIACAO_CLIENTE') NOT VALID");
                clientes.criar(request(suffix));
            }));
            boolean checkConstraintViolated = false;
            for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
                if (cause instanceof SQLException sql && "23514".equals(sql.getSQLState())) {
                    checkConstraintViolated = true;
                    break;
                }
            }
            assertTrue(checkConstraintViolated, "Failure must originate in PostgreSQL CHECK violation SQLSTATE 23514");
            assertEquals(0, countClients(email), "Business insert must roll back on a real audit INSERT failure");
            assertEquals(initialAuditCount, jdbc.queryForObject(
                    "SELECT count(*) FROM agerp.log_sistema WHERE acao='CRIACAO_CLIENTE'", Integer.class));
            assertEquals(0, jdbc.queryForObject(
                    "SELECT count(*) FROM pg_constraint WHERE conname='v01_test_reject_client_audit'", Integer.class),
                    "The transactional test-only constraint must not persist");
        } finally { SecurityContextHolder.clearContext(); }
    }

    @Test
    void parallelCommitsEachHaveExactlyOneDistinctAuditEvent() throws Exception {
        int workers = 8;
        String batch = UUID.randomUUID().toString();
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(workers)) {
            var futures = java.util.stream.IntStream.range(0, workers).mapToObj(i -> executor.submit(() -> {
                assertTrue(start.await(10, TimeUnit.SECONDS));
                auth();
                try { return clientes.criar(request(batch + "-" + i)).getId(); }
                finally { SecurityContextHolder.clearContext(); }
            })).toList();
            start.countDown();
            for (var future : futures) {
                int id = future.get(40, TimeUnit.SECONDS);
                assertEquals(1, countAudit(id), "Every committed client must have exactly one audit event");
                assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM agerp.log_sistema WHERE acao='CRIACAO_CLIENTE' AND recurso_id=? AND event_id IS NOT NULL",
                        Integer.class, String.valueOf(id)));
            }
            assertEquals(workers, jdbc.queryForObject(
                    "SELECT count(*) FROM agerp.cliente WHERE email LIKE ?", Integer.class, "audit-" + batch + "-%@example.invalid"));
        }
    }
}
