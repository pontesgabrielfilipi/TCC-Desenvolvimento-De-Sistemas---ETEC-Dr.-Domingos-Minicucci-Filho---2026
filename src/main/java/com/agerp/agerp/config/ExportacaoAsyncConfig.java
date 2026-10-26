package com.agerp.agerp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.Semaphore;

/** Bounded MVC executor: streaming must never rely on SimpleAsyncTaskExecutor. */
@Configuration
public class ExportacaoAsyncConfig implements WebMvcConfigurer {
    private final ThreadPoolTaskExecutor executor;

    public ExportacaoAsyncConfig(@Qualifier("exportacaoMvcExecutor") ThreadPoolTaskExecutor exportacaoMvcExecutor,
            ExportacaoProperties properties) {
        this.executor = exportacaoMvcExecutor;
        this.properties = properties;
    }

    @Bean("exportacaoMvcExecutor")
    public static ThreadPoolTaskExecutor exportacaoMvcExecutor(ExportacaoProperties properties) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix("agerp-mvc-stream-");
        executor.setCorePoolSize(properties.getCoreThreads());
        executor.setMaxPoolSize(properties.getMaxThreads());
        executor.setQueueCapacity(properties.getQueueCapacity());
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        executor.initialize();
        return executor;
    }

    @Bean("exportacaoVagas")
    public static Semaphore exportacaoVagas(ExportacaoProperties properties) {
        return new Semaphore(properties.getConcurrentLimit(), true);
    }

    private final ExportacaoProperties properties;

    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        configurer.setTaskExecutor(executor);
        configurer.setDefaultTimeout(properties.getTimeoutMs());
    }
}
