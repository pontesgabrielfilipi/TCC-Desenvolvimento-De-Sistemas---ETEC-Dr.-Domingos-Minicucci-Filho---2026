package com.agerp.agerp.service;

import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UsuarioService usuarioService;

    @Cacheable("adminEstatisticas")
    @Transactional(readOnly = true)
    public Map<String, Object> estatisticas() {
        return Map.of(
                "totalUsuarios", usuarioService.countTotalUsuarios(),
                "usuariosAtivos", usuarioService.countUsuariosAtivos()
        );
    }

    @Cacheable("adminConfiguracoes")
    public Map<String, Object> configuracoes() {
        return Map.of(
                "versao", "1.0.0",
                "ambiente", "Desenvolvimento"
        );
    }

    @Cacheable("adminRelatorios")
    public String relatorios() {
        return "Relatórios em desenvolvimento";
    }
}
