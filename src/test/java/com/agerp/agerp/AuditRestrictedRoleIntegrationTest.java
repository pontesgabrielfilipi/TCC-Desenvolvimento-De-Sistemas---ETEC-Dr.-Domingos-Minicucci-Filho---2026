package com.agerp.agerp;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.sql.DriverManager;
import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.*;

/** Usa um LOGIN real do PostgreSQL apenas no Testcontainer descartável. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AuditRestrictedRoleIntegrationTest {
    @Autowired JdbcTemplate owner;
    @Autowired PostgreSQLContainer postgres;

    @Test
    void usuarioRestritoPodeLerMasNaoAlterarOuApagarAuditoria() throws Exception {
        // O script cria aguser como NOLOGIN; o LOGIN só é habilitado dentro deste container descartável.
        owner.execute("ALTER ROLE aguser LOGIN PASSWORD 'v01-only-disposable-container'");
        owner.execute("GRANT USAGE ON SCHEMA agerp TO aguser");
        owner.execute("GRANT SELECT, INSERT ON agerp.log_sistema TO aguser");
        try {
            try (var restricted = DriverManager.getConnection(postgres.getJdbcUrl(), "aguser", "v01-only-disposable-container")) {
                assertEquals("aguser", restricted.getMetaData().getUserName());
                try (var statement = restricted.createStatement()) {
                    try (var result = statement.executeQuery("SELECT COUNT(*) FROM agerp.log_sistema")) {
                        assertTrue(result.next());
                    }
                    assertEquals("42501", assertThrows(SQLException.class,
                            () -> statement.executeUpdate("UPDATE agerp.log_sistema SET acao=acao WHERE FALSE")).getSQLState());
                    assertEquals("42501", assertThrows(SQLException.class,
                            () -> statement.executeUpdate("DELETE FROM agerp.log_sistema WHERE FALSE")).getSQLState());
                    assertEquals("42501", assertThrows(SQLException.class,
                            () -> statement.execute("TRUNCATE TABLE agerp.log_sistema")).getSQLState());
                }
            }
        } finally {
            owner.execute("REVOKE SELECT, INSERT ON agerp.log_sistema FROM aguser");
            owner.execute("REVOKE USAGE ON SCHEMA agerp FROM aguser");
            owner.execute("ALTER ROLE aguser NOLOGIN");
        }
    }
}
