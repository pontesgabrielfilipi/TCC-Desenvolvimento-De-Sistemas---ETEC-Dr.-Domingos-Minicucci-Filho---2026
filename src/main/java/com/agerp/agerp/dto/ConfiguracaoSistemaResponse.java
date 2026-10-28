// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

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
