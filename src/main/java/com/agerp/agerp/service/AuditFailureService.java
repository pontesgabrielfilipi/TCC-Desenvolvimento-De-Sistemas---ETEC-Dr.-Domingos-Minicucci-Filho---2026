package com.agerp.agerp.service;

import com.agerp.agerp.entity.LogSistema;
import com.agerp.agerp.repository.LogSistemaRepository;
import com.agerp.agerp.security.AuditRequestContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Usa uma transação curta e independente apenas para falhas observadas fora da transação de negócio. */
@Service
public class AuditFailureService {
    private static final Logger LOG = LoggerFactory.getLogger(AuditFailureService.class);
    private final LogSistemaRepository repository;

    public AuditFailureService(LogSistemaRepository repository) { this.repository = repository; }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrarFalha(String acao, String entidade, String resultado) {
        if (!"FALHA".equals(resultado) && !"NEGADO".equals(resultado))
            throw new IllegalArgumentException("Somente eventos de falha ou negação");
        LogSistema event = new LogSistema();
        event.setEventId(UUID.randomUUID());
        event.setAcao(truncate(acao, 100));
        event.setEntidade(truncate(entidade, 100));
        event.setResultado(resultado);
        AuditRequestContext context = AuditRequestContext.current();
        if (context != null) {
            event.setRequestId(context.requestId());
            event.setCorrelationId(context.correlationId());
            event.setPeerIp(context.peerIp());
            event.setIp(context.resolvedIp());
            event.setHttpMethod(context.method());
            event.setHttpRoute(context.route());
            event.setUserAgent(context.userAgent());
        }
        try {
            repository.saveAndFlush(event);
        } catch (RuntimeException exception) {
            LOG.error("Audit failure event could not be persisted; eventId={}, type={}", event.getEventId(), resultado);
            throw exception;
        }
    }

    private static String truncate(String value, int max) {
        return value == null ? null : value.substring(0, Math.min(max, value.length()));
    }
}
