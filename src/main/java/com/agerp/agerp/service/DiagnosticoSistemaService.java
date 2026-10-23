package com.agerp.agerp.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;

@Service
public class DiagnosticoSistemaService {
    @Value("${AGERP_IA_URL:http://localhost:8000}")
    private String iaUrl;

    private final ConfiguracaoSistemaService configuracoes;

    public DiagnosticoSistemaService(ConfiguracaoSistemaService configuracoes) {
        this.configuracoes = configuracoes;
    }

    public record Diagnostico(String versaoSistema, String bancoDados, String servicoIa,
                              String versaoModelo, Instant ultimaConfiguracao) { }

    public Diagnostico consultar() {
        // Access to persisted settings verifies connectivity without exposing connection strings.
        var config = configuracoes.consultar();
        String versao = getClass().getPackage().getImplementationVersion();
        if (versao == null || versao.isBlank()) versao = "Nao informada neste build";
        return new Diagnostico(versao, "OPERACIONAL", verificarIa(),
                "Nao informada pelo endpoint de saude", config.atualizadoEm());
    }

    private String verificarIa() {
        try {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(1000);
            factory.setReadTimeout(1000);
            var resposta = new RestTemplate(factory).getForEntity(
                    iaUrl.replaceAll("/+$", "") + "/health", String.class);
            return resposta.getStatusCode().is2xxSuccessful() ? "OPERACIONAL" : "INDISPONIVEL";
        } catch (Exception ignored) {
            return "INDISPONIVEL";
        }
    }
}
