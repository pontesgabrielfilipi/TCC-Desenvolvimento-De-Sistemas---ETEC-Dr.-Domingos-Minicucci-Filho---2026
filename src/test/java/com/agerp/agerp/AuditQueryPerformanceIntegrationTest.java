package com.agerp.agerp;

import com.agerp.agerp.service.LogSistemaService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.lang.management.ManagementFactory;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Small repeatable workload, NOT a production capacity or scalability claim. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional // The 10,000 synthetic logs are rolled back in the disposable test database.
class AuditQueryPerformanceIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired LogSistemaService logs;

    @Test
    void paginaAuditoriaComDezMilEventosSinteticos() {
        int inserted = jdbc.update("INSERT INTO agerp.log_sistema "
                + "(acao,entidade,data_hora,resultado) "
                + "SELECT 'V01_LOAD','AUDITORIA',CURRENT_TIMESTAMP - n * INTERVAL '1 second','SUCESSO' "
                + "FROM generate_series(1,10000) AS n");
        assertEquals(10_000, inserted);

        var page = PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "id"));
        var memory = ManagementFactory.getMemoryMXBean();
        long heapBefore = memory.getHeapMemoryUsage().getUsed();
        for (int i = 0; i < 5; i++) {
            assertEquals(10_000L, logs.pesquisar(null, null, "V01_LOAD", null, null, page).getTotalElements());
        }

        long[] timings = new long[30];
        for (int i = 0; i < timings.length; i++) {
            long started = System.nanoTime();
            var result = logs.pesquisar(null, null, "V01_LOAD", null, null, page);
            timings[i] = System.nanoTime() - started;
            assertEquals(10_000L, result.getTotalElements());
            assertEquals(50, result.getNumberOfElements());
        }
        long heapAfter = memory.getHeapMemoryUsage().getUsed();
        Arrays.sort(timings);
        System.out.printf("V01_PERF volume=10000 page=50 warmup=5 samples=30 "
                        + "p50_ms=%.3f p95_ms=%.3f max_ms=%.3f heap_before_mib=%.1f heap_after_mib=%.1f cpus=%d%n",
                timings[14] / 1e6, timings[28] / 1e6, timings[29] / 1e6,
                heapBefore / 1048576.0, heapAfter / 1048576.0,
                Runtime.getRuntime().availableProcessors());
    }
}
