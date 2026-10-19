package com.agerp.agerp.controller;

import com.agerp.agerp.service.ConfiguracaoSistemaService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Apenas preferencias de apresentacao sem detalhes administrativos. Requer autenticacao em SecurityConfig. */
@RestController
@RequestMapping("/api/configuracoes")
public class ConfiguracaoPublicaController {
    private final ConfiguracaoSistemaService configuracoes;

    public ConfiguracaoPublicaController(ConfiguracaoSistemaService configuracoes) {
        this.configuracoes = configuracoes;
    }

    public record Aparencia(String nomeEmpresa, boolean exibirAlertasEstoque) { }

    @GetMapping("/aparencia")
    public Aparencia aparencia() {
        var config = configuracoes.aparencia();
        return new Aparencia(config.nomeEmpresa(), config.exibirAlertasEstoque());
    }
}
