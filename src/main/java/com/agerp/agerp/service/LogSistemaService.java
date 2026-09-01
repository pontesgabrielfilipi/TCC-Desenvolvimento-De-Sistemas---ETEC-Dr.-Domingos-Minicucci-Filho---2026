package com.agerp.agerp.service;

import com.agerp.agerp.dto.LogSistemaResponse;
import com.agerp.agerp.entity.LogSistema;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.LogSistemaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LogSistemaService {

    private final LogSistemaRepository logSistemaRepository;

    @Transactional
    public void registrarLog(Usuario usuario, String acao, String entidade, String ip) {
        LogSistema log = new LogSistema();
        log.setIdUsuario(usuario);
        log.setAcao(acao);
        log.setEntidade(entidade);
        log.setIp(ip != null ? ip : "0.0.0.0");

        logSistemaRepository.save(log);
    }

    @Transactional(readOnly = true)
    public List<LogSistemaResponse> listarTodos() {
        return logSistemaRepository.findAllByOrderByDataHoraDesc()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LogSistema> listarPorUsuario(Integer usuarioId) {
        return logSistemaRepository.findByIdUsuarioOrderByDataHoraDesc(usuarioId);
    }

    private LogSistemaResponse toResponse(LogSistema log) {
        return new LogSistemaResponse(
                log.getId(),
                log.getAcao(),
                log.getEntidade(),
                log.getDataHora(),
                log.getIp(),
                log.getIdUsuario() != null ? log.getIdUsuario().getNome() : "Desconhecido"
        );
    }
}
