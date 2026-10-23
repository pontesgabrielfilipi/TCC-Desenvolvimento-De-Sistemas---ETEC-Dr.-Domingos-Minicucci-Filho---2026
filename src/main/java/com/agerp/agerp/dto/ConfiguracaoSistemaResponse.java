package com.agerp.agerp.dto;

import java.time.Instant;

public record ConfiguracaoSistemaResponse(
        String nomeEmpresa,
        Integer limiteEstoqueBaixo,
        Boolean usarEstoqueMinimoGeral,
        Boolean exibirAlertasEstoque,
        Integer timeoutIaMs,
        Long versao,
        Instant atualizadoEm) {
}
