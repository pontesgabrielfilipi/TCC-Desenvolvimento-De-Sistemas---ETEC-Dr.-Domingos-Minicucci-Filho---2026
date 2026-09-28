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
public class PedidoCreateRequest {

    @NotNull(message = "ID do cliente é obrigatório")
    private Integer idCliente;

    @NotNull(message = "Itens do pedido é obrigatório")
    @NotEmpty(message = "Pedido deve conter pelo menos um item")
    @Valid
    private List<ItemPedidoRequest> itens;

    private String observacoes;
}
