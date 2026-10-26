package com.agerp.agerp;

import java.time.Duration;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        return new PostgreSQLContainer(DockerImageName.parse("postgres:16-alpine"))
                // Test-only role expected by Flyway V9's default auditAppRole=aguser.
                // This is an isolated container; no production roles or migrations are changed.
                .withInitScript("db/test/create-audit-role.sql")
                .withStartupTimeout(Duration.ofMinutes(2));
    }

}
