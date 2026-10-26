package com.agerp.agerp;

import com.agerp.agerp.dto.ConfiguracaoSistemaRequest;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.UsuarioRepository;
import com.agerp.agerp.service.ConfiguracaoSistemaService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/** Real competing updates, only against the disposable PostgreSQL 16 Testcontainers database. */
@SpringBootTest(properties = "agerp.seed.enabled=true")
@Import(TestcontainersConfiguration.class)
class ConfiguracaoAuditoriaConcorrenciaIntegrationTest {
    @Autowired private ConfiguracaoSistemaService configuracoes;
    @Autowired private UsuarioRepository usuarios;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlatformTransactionManager txManager;

    @Test
    void concurrentVersionedUpdatesCommitAndAuditExactlyOneWinner() throws Exception {
        Usuario admin = new TransactionTemplate(txManager).execute(tx -> usuarios.findAll().stream()
                .filter(u -> "ADMIN".equalsIgnoreCase(u.getIdPerfil().getNome()))
                .findFirst().orElseThrow());
        var original = configuracoes.consultar();
        int initialEvents = auditCount();
        int firstLimit = original.limiteEstoqueBaixo() + 101;
        int secondLimit = original.limiteEstoqueBaixo() + 102;
        CountDownLatch start = new CountDownLatch(1);

        try {
            boolean firstSucceeded;
            boolean secondSucceeded;
            try (var executor = Executors.newFixedThreadPool(2)) {
                var first = executor.submit(() -> updateWhenReleased(admin, original, firstLimit, start));
                var second = executor.submit(() -> updateWhenReleased(admin, original, secondLimit, start));
                start.countDown();
                firstSucceeded = first.get(40, TimeUnit.SECONDS);
                secondSucceeded = second.get(40, TimeUnit.SECONDS);
            }

            assertNotEquals(firstSucceeded, secondSucceeded,
                    "An unchanged version must not overwrite another committed configuration");
            var persisted = configuracoes.consultar();
            assertEquals(firstSucceeded ? firstLimit : secondLimit, persisted.limiteEstoqueBaixo());
            assertEquals(original.versao() + 1, persisted.versao());
            assertEquals(initialEvents + 1, auditCount(),
                    "The failed transaction must not persist a success event");
        } finally {
            // Preserve other tests' expected settings; this is still an isolated database.
            var current = configuracoes.consultar();
            if (current.limiteEstoqueBaixo() != original.limiteEstoqueBaixo()) {
                configuracoes.atualizar(new ConfiguracaoSistemaRequest(original.nomeEmpresa(),
                        original.limiteEstoqueBaixo(), original.usarEstoqueMinimoGeral(),
                        original.exibirAlertasEstoque(), original.timeoutIaMs(), current.versao()),
                        admin, "127.0.0.1");
            }
        }
    }

    private boolean updateWhenReleased(Usuario admin,
            com.agerp.agerp.dto.ConfiguracaoSistemaResponse original,
            int limit, CountDownLatch start) throws InterruptedException {
        assertTrue(start.await(10, TimeUnit.SECONDS));
        try {
            configuracoes.atualizar(new ConfiguracaoSistemaRequest(original.nomeEmpresa(),
                    limit, original.usarEstoqueMinimoGeral(), original.exibirAlertasEstoque(),
                    original.timeoutIaMs(), original.versao()), admin, "127.0.0.1");
            return true;
        } catch (OptimisticLockingFailureException expectedConflict) {
            return false;
        }
    }

    private int auditCount() {
        return jdbc.queryForObject("SELECT count(*) FROM agerp.log_sistema "
                        + "WHERE acao='ALTERACAO_CONFIGURACOES' AND recurso_id='1'",
                Integer.class);
    }
}
