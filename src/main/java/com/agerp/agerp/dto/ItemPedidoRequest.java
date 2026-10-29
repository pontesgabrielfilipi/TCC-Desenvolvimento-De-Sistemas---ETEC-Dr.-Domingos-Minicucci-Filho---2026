// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ItemPedidoRequest {

    @NotNull(message = "ID do produto é obrigatório")
    private Integer idProduto;

    @NotNull(message = "Quantidade é obrigatória")
    @Positive(message = "Quantidade deve ser maior que zero")
    private Integer quantidade;
}
