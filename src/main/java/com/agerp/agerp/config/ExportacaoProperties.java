// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Component
@Validated
@Getter
@Setter
@ConfigurationProperties(prefix = "agerp.export")
public class ExportacaoProperties {
    @Min(1) @Max(64)
    private int coreThreads = 2;
    @Min(1) @Max(64)
    private int maxThreads = 4;
    @Min(0) @Max(10000)
    private int queueCapacity = 8;
    @Min(1000) @Max(3600000)
    private long timeoutMs = 300000;
    @Min(1) @Max(64)
    private int concurrentLimit = 3;

    @AssertTrue(message = "core-threads deve ser <= max-threads")
    public boolean isThreadPoolValid() { return coreThreads <= maxThreads; }
}
