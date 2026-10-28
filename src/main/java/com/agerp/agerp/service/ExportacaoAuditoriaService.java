package com.agerp.agerp.service;

import com.agerp.agerp.entity.LogSistema;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.LogSistemaRepository;
import com.agerp.agerp.security.AuditRequestContext;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Isola a auditoria das consultas read-only e permite o uso seguro nos callbacks assíncronos. */
@Service
public class ExportacaoAuditoriaService {
    private final LogSistemaRepository repository;
    private final EntityManager entityManager;

    public ExportacaoAuditoriaService(LogSistemaRepository repository, EntityManager entityManager) {
        this.repository = repository;
        this.entityManager = entityManager;
    }

    public record Contexto(UUID exportId, AuditRequestContext request, Integer usuarioId,
                           String nome, String email, String perfil, String sessao,
                           String dispositivo, String relatorioId, Map<String, Object> filtros) {
        public Contexto {
            filtros = Map.copyOf(filtros);
        }
    }

    /** Não aceita dados pessoais livres, query strings, cabeçalhos de autorização nem tokens. */
    public static Map<String, Object> filtrosSeguros(RelatorioAdminService.Filtros f) {
        Map<String, Object> filtrados = new LinkedHashMap<>();
        if (f.inicio() != null) filtrados.put("inicio", f.inicio().toString());
        if (f.fim() != null) filtrados.put("fim", f.fim().toString());
        if (f.clienteId() != null) filtrados.put("clienteId", f.clienteId());
        if (f.produtoId() != null) filtrados.put("produtoId", f.produtoId());
        if (f.usuarioId() != null) filtrados.put("usuarioId", f.usuarioId());
        if (f.status() != null) filtrados.put("status", f.status());
        return filtrados;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrar(Contexto ctx, String acao, String resultado, Integer registros,
                         Long bytes, long duracaoMs, String motivo) {
        LogSistema evento = new LogSistema();
        evento.setEventId(UUID.randomUUID());
        evento.setAcao(acao);
        evento.setEntidade("RELATORIO");
        evento.setRecursoId(ctx.exportId().toString());
        evento.setResultado(resultado);
        evento.setDurationMs(Math.max(0, duracaoMs));
        evento.setUsuarioNome(ctx.nome());
        evento.setUsuarioEmail(ctx.email());
        evento.setUsuarioPerfil(ctx.perfil());
        if (ctx.usuarioId() != null) {
            Usuario usuario = entityManager.getReference(Usuario.class, ctx.usuarioId());
            evento.setIdUsuario(usuario);
        }
        evento.setSessionRef(ctx.sessao());
        evento.setDeviceRef(ctx.dispositivo());
        if (ctx.request() != null) {
            evento.setRequestId(ctx.request().requestId());
            evento.setCorrelationId(ctx.request().correlationId());
            evento.setPeerIp(ctx.request().peerIp());
            evento.setIp(ctx.request().resolvedIp());
            evento.setHttpMethod(ctx.request().method());
            evento.setHttpRoute(ctx.request().route());
            evento.setUserAgent(ctx.request().userAgent());
        }
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("relatorioId", ctx.relatorioId());
        detalhes.put("filtros", ctx.filtros());
        if (registros != null) detalhes.put("registros", registros);
        if (bytes != null) detalhes.put("arquivoBytes", bytes);
        detalhes.put("duracaoMs", evento.getDurationMs());
        if (motivo != null) detalhes.put("motivo", motivo);
        evento.setChangesJson(detalhes);
        repository.saveAndFlush(evento);
    }

    /** Usado apenas na recuperação do spool bloqueado pelo proprietário; não indica download concluído. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrarRecuperacao(UUID exportId) {
        var historico = repository.findByEntidadeAndRecursoIdOrderByIdAsc("RELATORIO", exportId.toString());
        boolean terminal = historico.stream().anyMatch(e ->
                "EXPORTACAO_FALHA".equals(e.getAcao())
                        || "EXPORTACAO_TRANSMISSAO_ENCERRADA".equals(e.getAcao()));
        var original = historico.isEmpty() ? null : historico.get(0);
        LogSistema evento = new LogSistema();
        evento.setEventId(UUID.randomUUID());
        evento.setEntidade("RELATORIO");
        evento.setRecursoId(exportId.toString());
        evento.setAcao(terminal ? "EXPORTACAO_RESIDUO_RECUPERADO" : "EXPORTACAO_FALHA");
        evento.setResultado(terminal ? "OBSERVADO" : "FALHA");
        evento.setDurationMs(0L);
        if (original != null) {
            evento.setIdUsuario(original.getIdUsuario());
            evento.setUsuarioNome(original.getUsuarioNome());
            evento.setUsuarioEmail(original.getUsuarioEmail());
            evento.setUsuarioPerfil(original.getUsuarioPerfil());
            evento.setSessionRef(original.getSessionRef());
            evento.setDeviceRef(original.getDeviceRef());
            evento.setRequestId(original.getRequestId());
            evento.setCorrelationId(original.getCorrelationId());
            evento.setPeerIp(original.getPeerIp());
            evento.setIp(original.getIp());
            evento.setHttpMethod(original.getHttpMethod());
            evento.setHttpRoute(original.getHttpRoute());
            evento.setUserAgent(original.getUserAgent());
        }
        evento.setChangesJson(Map.of("motivo", terminal ? "RESIDUO_APOS_TERMINAL" : "INTERRUPCAO_PROCESSO",
                "recuperacao", true));
        repository.saveAndFlush(evento);
    }
}
