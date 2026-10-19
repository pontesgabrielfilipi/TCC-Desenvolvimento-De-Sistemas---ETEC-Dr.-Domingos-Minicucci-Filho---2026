package com.agerp.agerp.service;

import com.agerp.agerp.dto.LogSistemaResponse;
import com.agerp.agerp.entity.LogSistema;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.LogSistemaRepository;
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
        LogSistema log = new LogSistema();
        log.setIdUsuario(usuario);
        log.setAcao(limitar(acao, 100));
        log.setEntidade(limitar(entidade, 100));
        log.setIp(limitar(ip == null || ip.isBlank() ? "0.0.0.0" : ip, 50));
        log.setRecursoId(limitar(recursoId, 100));
        log.setResultado(limitar(resultado, 50));
        log.setDetalhes(limitar(detalhes, 2000));
        if (usuario != null) {
            log.setUsuarioNome(limitar(usuario.getNome(), 150));
            log.setUsuarioEmail(limitar(usuario.getEmail(), 255));
            log.setUsuarioPerfil(usuario.getIdPerfil() == null ? null : limitar(usuario.getIdPerfil().getNome(), 100));
        }
        logSistemaRepository.save(log);
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
        return new LogSistemaResponse(log.getId(), log.getAcao(), log.getEntidade(), log.getDataHora(), log.getIp(),
                atual == null ? null : atual.getId(),
                primeiro(log.getUsuarioNome(), atual == null ? null : atual.getNome(), "Desconhecido"),
                primeiro(log.getUsuarioEmail(), atual == null ? null : atual.getEmail(), null),
                primeiro(log.getUsuarioPerfil(), atual == null || atual.getIdPerfil() == null ? null : atual.getIdPerfil().getNome(), null),
                log.getRecursoId(), log.getResultado(), log.getDetalhes());
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
