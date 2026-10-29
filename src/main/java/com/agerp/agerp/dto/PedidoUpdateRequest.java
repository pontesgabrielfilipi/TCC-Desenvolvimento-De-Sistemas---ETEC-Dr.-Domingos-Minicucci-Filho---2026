// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PedidoUpdateRequest {

    @NotNull(message = "ID do cliente é obrigatório")
    private Integer idCliente;

    private Integer idEndereco; // Opcional — endereço de entrega

    @NotNull(message = "Itens do pedido é obrigatório")
    @NotEmpty(message = "Pedido deve conter pelo menos um item")
    @Valid
    private List<ItemPedidoRequest> itens;

    private String observacoes;
}
