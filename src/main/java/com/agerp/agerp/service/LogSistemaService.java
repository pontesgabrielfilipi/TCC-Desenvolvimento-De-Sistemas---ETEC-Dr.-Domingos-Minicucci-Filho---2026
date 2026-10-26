package com.agerp.agerp.service;

import com.agerp.agerp.dto.LogSistemaResponse;
import com.agerp.agerp.entity.LogSistema;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.LogSistemaRepository;
import com.agerp.agerp.security.AuditRequestContext;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class LogSistemaService {

    private static final Pattern RECURSO_NA_ACAO = Pattern.compile("(?:USUARIO|PEDIDO|PRODUTO|CLIENTE)_(\\d+)");
    private final LogSistemaRepository logSistemaRepository;

    public LogSistemaService(LogSistemaRepository logSistemaRepository) {
        this.logSistemaRepository = logSistemaRepository;
    }

    @Transactional
    public void registrarLog(Usuario usuario, String acao, String entidade, String ip) {
        registrarLog(usuario, acao, entidade, extrairRecursoId(acao), "SUCESSO", null, ip);
    }

    @Transactional
    public void registrarLog(Usuario usuario, String acao, String entidade, String recursoId,
            String resultado, String detalhes, String ip) {
        registrarEvento(usuario, acao, entidade, recursoId, resultado, detalhes, ip, Map.of());
    }

    @Transactional
    public void registrarEvento(Usuario usuario, String acao, String entidade, String recursoId,
            String resultado, String detalhes, String ip, Map<String, ?> alteracoes) {
        if (!org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Auditoria obrigatória requer transação ativa");
        }
        LogSistema log = new LogSistema();
        log.setEventId(UUID.randomUUID());
        AuditRequestContext context = AuditRequestContext.current();
        if (context != null) {
            log.setRequestId(context.requestId());
            log.setCorrelationId(context.correlationId());
            log.setPeerIp(context.peerIp());
            log.setUserAgent(context.userAgent());
            log.setHttpMethod(context.method());
            log.setHttpRoute(context.route());
        }
        var attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servlet) {
            Object sid = servlet.getRequest().getAttribute("agerp.session.id");
            Object device = servlet.getRequest().getAttribute("agerp.device.id");
            if (sid != null) log.setSessionRef(sid.toString());
            if (device != null) log.setDeviceRef(device.toString());
        }
        log.setIdUsuario(usuario);
        log.setAcao(limitar(acao, 100));
        log.setEntidade(limitar(entidade, 100));
        log.setIp(limitar(context == null ? ip : context.resolvedIp(), 50));
        log.setRecursoId(limitar(recursoId, 100));
        log.setResultado(limitar(resultado, 50));
        // Legacy freeform details can include sensitive payloads; only safe structured changes are persisted.
        log.setDetalhes(null);
        log.setChangesJson(sanitizeChanges(alteracoes));
        if (usuario != null) {
            log.setUsuarioNome(limitar(usuario.getNome(), 150));
            log.setUsuarioEmail(limitar(usuario.getEmail(), 255));
            log.setUsuarioPerfil(usuario.getIdPerfil() == null ? null : limitar(usuario.getIdPerfil().getNome(), 100));
        }
        logSistemaRepository.saveAndFlush(log); // fail closed within the domain transaction
    }

    private static final Set<String> ALLOWED_CHANGES = Set.of(
            "status", "perfil", "ativo", "nome", "email", "categoria", "quantidade",
            "preco", "custo", "valor", "prazo", "tipo", "estoqueMinimo", "paginas",
            "quantidadeAtual", "quantidadeMinima", "nivelAutoridade", "clienteId", "pedidoId",
            "produtoId", "enderecoId", "limiteEstoqueBaixo", "usarEstoqueMinimoGeral",
            "exibirAlertasEstoque", "timeoutIaMs", "modeloVersao", "duracaoMs", "estado");

    static Map<String, Object> sanitizeChanges(Map<String, ?> source) {
        if (source == null || source.isEmpty()) return Map.of();
        Map<String, Object> output = new LinkedHashMap<>();
        for (var entry : source.entrySet()) {
            if (output.size() >= 16) break;
            if (!ALLOWED_CHANGES.contains(entry.getKey())) continue;
            Object value = entry.getValue();
            if (value instanceof Map<?, ?> diff && diff.keySet().stream().allMatch(k -> "antes".equals(k) || "depois".equals(k))) {
                Map<String, Object> safeDiff = new LinkedHashMap<>();
                for (String side : List.of("antes", "depois")) {
                    Object item = diff.get(side);
                    if (item == null || item instanceof Number || item instanceof Boolean) safeDiff.put(side, item);
                    else if (item instanceof String s && !s.matches("(?i).*(bearer\\s+|password|passwd|secret|token|api[_-]?key).*"))
                        safeDiff.put(side, s.substring(0, Math.min(120, s.length())).replaceAll("[\\p{Cntrl}]", " "));
                }
                if (!safeDiff.isEmpty()) output.put(entry.getKey(), safeDiff);
            } else if (value instanceof Number || value instanceof Boolean) output.put(entry.getKey(), value);
            else if (value instanceof String text) {
                String normalized = text.replaceAll("[\\p{Cntrl}]", " ");
                // Do not persist credential-shaped values even under a permitted field name.
                if (normalized.matches("(?i).*(bearer\\s+|password|passwd|secret|token|api[_-]?key|private[_-]?key).*")) {
                    output.put(entry.getKey(), "[REDACTED]");
                } else {
                    output.put(entry.getKey(), normalized.substring(0, Math.min(120, normalized.length())));
                }
            }
        }
        return Map.copyOf(output);
    }

    @Transactional(readOnly = true)
    public Page<LogSistemaResponse> pesquisar(String email, String perfil, String acao,
            Instant inicio, Instant fim, Pageable pageable) {
        Specification<LogSistema> filtros = (root, query, cb) -> {
            var usuario = root.join("idUsuario", JoinType.LEFT);
            var perfilUsuario = usuario.join("idPerfil", JoinType.LEFT);
            List<Predicate> predicates = new ArrayList<>();
            if (temTexto(email)) {
                var valor = cb.coalesce(root.<String>get("usuarioEmail"), usuario.<String>get("email"));
                predicates.add(cb.like(cb.lower(valor), conter(email)));
            }
            if (temTexto(perfil)) {
                var valor = cb.coalesce(root.<String>get("usuarioPerfil"), perfilUsuario.<String>get("nome"));
                predicates.add(cb.like(cb.lower(valor), conter(perfil)));
            }
            if (temTexto(acao)) {
                predicates.add(cb.like(cb.lower(root.get("acao")), conter(acao)));
            }
            if (inicio != null) predicates.add(cb.greaterThanOrEqualTo(root.get("dataHora"), inicio));
            if (fim != null) predicates.add(cb.lessThanOrEqualTo(root.get("dataHora"), fim));
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        return logSistemaRepository.findAll(filtros, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<LogSistemaResponse> pesquisarGeral(String termo, List<String> campos,
            Instant inicio, Instant fim, Pageable pageable) {
        Specification<LogSistema> filtros = (root, query, cb) -> {
            var usuario = root.join("idUsuario", JoinType.LEFT);
            var perfilUsuario = usuario.join("idPerfil", JoinType.LEFT);
            List<Predicate> obrigatorios = new ArrayList<>();
            if (temTexto(termo)) {
                List<String> selecionados = campos == null || campos.isEmpty()
                        ? List.of("email", "perfil", "acao", "entidade") : campos;
                List<Predicate> alternativas = new ArrayList<>();
                for (String campo : selecionados) {
                    switch (campo) {
                        case "email" -> alternativas.add(cb.like(cb.lower(
                                cb.coalesce(root.<String>get("usuarioEmail"), usuario.<String>get("email"))), conter(termo)));
                        case "perfil" -> alternativas.add(cb.like(cb.lower(
                                cb.coalesce(root.<String>get("usuarioPerfil"), perfilUsuario.<String>get("nome"))), conter(termo)));
                        case "acao" -> alternativas.add(cb.like(cb.lower(root.get("acao")), conter(termo)));
                        case "entidade" -> alternativas.add(cb.like(cb.lower(root.get("entidade")), conter(termo)));
                        case "ip" -> alternativas.add(cb.like(cb.lower(root.get("ip")), conter(termo)));
                        default -> { /* ignora campos não permitidos */ }
                    }
                }
                if (!alternativas.isEmpty()) obrigatorios.add(cb.or(alternativas.toArray(Predicate[]::new)));
            }
            if (inicio != null) obrigatorios.add(cb.greaterThanOrEqualTo(root.get("dataHora"), inicio));
            if (fim != null) obrigatorios.add(cb.lessThanOrEqualTo(root.get("dataHora"), fim));
            return cb.and(obrigatorios.toArray(Predicate[]::new));
        };
        return logSistemaRepository.findAll(filtros, pageable).map(this::toResponse);
    }

    private LogSistemaResponse toResponse(LogSistema log) {
        Usuario atual = log.getIdUsuario();
        var result = new LogSistemaResponse(log.getId(), log.getAcao(), log.getEntidade(), log.getDataHora(), log.getIp(),
                atual == null ? null : atual.getId(),
                primeiro(log.getUsuarioNome(), null, "Desconhecido"),
                primeiro(log.getUsuarioEmail(), null, null),
                primeiro(log.getUsuarioPerfil(), null, null),
                log.getRecursoId(), log.getResultado(), null);
        result.setIdentidadeHistoricaConfirmada(temTexto(log.getUsuarioNome()) && temTexto(log.getUsuarioEmail()));
        result.setRequestId(log.getRequestId() == null ? null : log.getRequestId().toString());
        result.setSessionRef(log.getSessionRef());
        result.setDeviceRef(log.getDeviceRef());
        result.setCorrelationId(log.getCorrelationId());
        result.setUserAgent(log.getUserAgent());
        result.setPeerIp(log.getPeerIp());
        result.setHttpMethod(log.getHttpMethod());
        result.setHttpRoute(log.getHttpRoute());
        result.setHttpStatus(log.getHttpStatus());
        result.setChangesJson(log.getChangesJson());
        result.setOrigemConfianca(log.getRequestId() == null ? "DESCONHECIDA" : "LIMITADA");
        return result;
    }

    @Transactional(readOnly = true)
    public Page<LogSistemaResponse> pesquisarAvancado(String email, String perfil, String acao, String resultado,
            String entidade, String recursoId, String sessionRef, String requestId, String ip,
            String search, List<String> fields, Instant inicio, Instant fim, Pageable pageable) {
        if (inicio != null && fim != null && inicio.isAfter(fim))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Período inválido");
        UUID request = null;
        if (temTexto(requestId)) {
            try { request = UUID.fromString(requestId.trim()); }
            catch (IllegalArgumentException error) {
                throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Request ID inválido");
            }
        }
        final UUID requestFilter = request;
        if (fields != null && fields.stream().anyMatch(f -> !Set.of("email", "perfil", "acao", "entidade", "ip").contains(f)))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Campo de pesquisa inválido");
        Specification<LogSistema> spec = (root, query, cb) -> {
            var usuario = root.join("idUsuario", JoinType.LEFT);
            var perfilUsuario = usuario.join("idPerfil", JoinType.LEFT);
            List<Predicate> all = new ArrayList<>();
            if (temTexto(email)) all.add(cb.like(cb.lower(cb.coalesce(root.<String>get("usuarioEmail"), usuario.<String>get("email"))), conter(email)));
            if (temTexto(perfil)) all.add(cb.like(cb.lower(cb.coalesce(root.<String>get("usuarioPerfil"), perfilUsuario.<String>get("nome"))), conter(perfil)));
            if (temTexto(acao)) all.add(cb.equal(cb.upper(root.get("acao")), acao.trim().toUpperCase(Locale.ROOT)));
            if (temTexto(resultado)) all.add(cb.equal(cb.upper(root.get("resultado")), resultado.trim().toUpperCase(Locale.ROOT)));
            if (temTexto(entidade)) all.add(cb.equal(cb.upper(root.get("entidade")), entidade.trim().toUpperCase(Locale.ROOT)));
            if (temTexto(recursoId)) all.add(cb.equal(root.get("recursoId"), recursoId.trim()));
            if (temTexto(sessionRef)) all.add(cb.equal(root.get("sessionRef"), sessionRef.trim()));
            if (requestFilter != null) all.add(cb.equal(root.get("requestId"), requestFilter));
            if (temTexto(ip)) all.add(cb.equal(root.get("ip"), ip.trim()));
            if (inicio != null) all.add(cb.greaterThanOrEqualTo(root.get("dataHora"), inicio));
            if (fim != null) all.add(cb.lessThanOrEqualTo(root.get("dataHora"), fim));
            if (temTexto(search)) {
                List<Predicate> ors = new ArrayList<>();
                for (String field : fields == null || fields.isEmpty() ? List.of("email", "perfil", "acao", "entidade") : fields) {
                    switch (field) {
                        case "email" -> ors.add(cb.like(cb.lower(cb.coalesce(root.<String>get("usuarioEmail"), usuario.<String>get("email"))), conter(search)));
                        case "perfil" -> ors.add(cb.like(cb.lower(cb.coalesce(root.<String>get("usuarioPerfil"), perfilUsuario.<String>get("nome"))), conter(search)));
                        case "acao" -> ors.add(cb.like(cb.lower(root.get("acao")), conter(search)));
                        case "entidade" -> ors.add(cb.like(cb.lower(root.get("entidade")), conter(search)));
                        case "ip" -> ors.add(cb.like(cb.lower(root.get("ip")), conter(search)));
                    }
                }
                all.add(cb.or(ors.toArray(Predicate[]::new)));
            }
            return cb.and(all.toArray(Predicate[]::new));
        };
        return logSistemaRepository.findAll(spec, pageable).map(this::toResponse);
    }

    private static String extrairRecursoId(String acao) {
        if (acao == null) return null;
        Matcher matcher = RECURSO_NA_ACAO.matcher(acao.toUpperCase(Locale.ROOT));
        return matcher.find() ? matcher.group(1) : null;
    }

    private static boolean temTexto(String valor) { return valor != null && !valor.isBlank(); }
    private static String conter(String valor) { return "%" + valor.trim().toLowerCase(Locale.ROOT) + "%"; }
    private static String limitar(String valor, int max) { return valor == null ? null : valor.substring(0, Math.min(valor.length(), max)); }
    private static String primeiro(String snapshot, String atual, String fallback) {
        return temTexto(snapshot) ? snapshot : (temTexto(atual) ? atual : fallback);
    }
}
