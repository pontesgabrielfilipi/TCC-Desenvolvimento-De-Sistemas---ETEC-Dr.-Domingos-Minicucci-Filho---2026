package com.agerp.agerp.config;

import com.agerp.agerp.service.ExportacaoFluxo;
import jakarta.servlet.AsyncEvent;
import jakarta.servlet.AsyncListener;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.CountDownLatch;

/** Observa a conclusão assíncrona mesmo quando o Spring não consegue agendar o callback do stream. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ExportacaoAsyncCleanupFilter extends OncePerRequestFilter {
    public static final String ATTR = ExportacaoAsyncCleanupFilter.class.getName() + ".stream";
    public static final String BARRIER = ExportacaoAsyncCleanupFilter.class.getName() + ".filtersFinished";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        CountDownLatch filtersFinished = new CountDownLatch(1);
        request.setAttribute(BARRIER, filtersFinished);
        try {
            chain.doFilter(request, response);
        } finally {
            try {
                Object pending = request.getAttribute(ATTR);
                if (pending instanceof ExportacaoFluxo flow) {
                    if (!request.isAsyncStarted()) {
                        flow.falhaAsync("ASYNC_NAO_INICIADO");
                    } else {
                        AsyncListener listener = new AsyncListener() {
                            @Override public void onComplete(AsyncEvent event) { flow.falhaAsync("ASYNC_SEM_CALLBACK"); }
                            @Override public void onTimeout(AsyncEvent event) { flow.falhaAsync("ASYNC_TIMEOUT"); }
                            @Override public void onError(AsyncEvent event) { flow.falhaAsync("ASYNC_ERRO"); }
                            @Override public void onStartAsync(AsyncEvent event) { event.getAsyncContext().addListener(this); }
                        };
                        try {
                            request.getAsyncContext().addListener(listener);
                        } catch (IllegalStateException completed) {
                            // A requisição terminou entre isAsyncStarted() e addListener().
                            // Se o stream já registrou o terminal, o guard atômico não duplica.
                            flow.falhaAsync("ASYNC_ENCERRADO_ANTES_DO_LISTENER");
                        }
                    }
                }
            } finally {
                filtersFinished.countDown();
            }
        }
    }
}
