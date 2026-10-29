// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ConfiguracaoSistemaRequest(
        @NotBlank @Size(max = 100) String nomeEmpresa,
        @NotNull @Min(1) @Max(100000) Integer limiteEstoqueBaixo,
        @NotNull Boolean usarEstoqueMinimoGeral,
        @NotNull Boolean exibirAlertasEstoque,
        @NotNull @Min(500) @Max(15000) Integer timeoutIaMs,
        @NotNull @Min(0) Long versao) {
}
