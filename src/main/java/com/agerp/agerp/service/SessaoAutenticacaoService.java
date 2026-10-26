package com.agerp.agerp.service;

import com.agerp.agerp.entity.SessaoAutenticacao;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.SessaoAutenticacaoRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessaoAutenticacaoService {
    private final SessaoAutenticacaoRepository repository;

    public SessaoAutenticacaoService(SessaoAutenticacaoRepository repository) { this.repository = repository; }

    @Transactional
    public SessaoAutenticacao criar(Usuario usuario, UUID device, long durationMs) {
        SessaoAutenticacao sessao = new SessaoAutenticacao();
        sessao.setId(UUID.randomUUID());
        sessao.setUsuario(usuario);
        sessao.setDeviceRef(device);
        sessao.setCriadaEm(Instant.now());
        sessao.setExpiraEm(sessao.getCriadaEm().plusMillis(durationMs));
        return repository.saveAndFlush(sessao);
    }

    @Transactional(readOnly = true)
    public boolean valida(UUID sid, Integer usuarioId) {
        if (sid == null || usuarioId == null) return false;
        return repository.findById(sid).map(s -> s.getUsuario().getId().equals(usuarioId)
                && s.getRevogadaEm() == null && s.getExpiraEm().isAfter(Instant.now())).orElse(false);
    }

    @Transactional(readOnly = true)
    public UUID dispositivo(UUID sid) {
        if (sid == null) return null;
        return repository.findById(sid).map(SessaoAutenticacao::getDeviceRef).orElse(null);
    }

    @Transactional
    public void revogar(UUID sid, String motivo) {
        if (sid == null) return;
        repository.findById(sid).ifPresent(s -> {
            if (s.getRevogadaEm() == null) {
                s.setRevogadaEm(Instant.now());
                s.setMotivoRevogacao(motivo);
                repository.saveAndFlush(s);
            }
        });
    }

    @Transactional
    public boolean revogarDoUsuario(UUID sid, Integer userId, String motivo) {
        return repository.findById(sid).filter(s -> s.getUsuario().getId().equals(userId)).map(s -> {
            if (s.getRevogadaEm() == null) {
                s.setRevogadaEm(Instant.now());
                s.setMotivoRevogacao(motivo);
                repository.saveAndFlush(s);
            }
            return true;
        }).orElse(false);
    }

    @Transactional(readOnly = true)
    public List<SessaoAutenticacao> listar(Integer userId) {
        return repository.findByUsuarioIdOrderByCriadaEmDesc(userId);
    }
}
