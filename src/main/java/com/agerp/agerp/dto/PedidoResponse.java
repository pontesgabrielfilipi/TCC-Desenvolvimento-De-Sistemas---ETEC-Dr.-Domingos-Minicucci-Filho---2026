package com.agerp.agerp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PedidoResponse {

    private Integer id;
    private Integer idCliente;
    private String nomeCliente;
    private Integer idEndereco;
    private String enderecoResumo; // Logradouro, Número - Bairro, Cidade/UF
    private Instant dataPedido;
    private String status;
    private BigDecimal valorTotal;
    private Integer idUsuario;
    private String nomeUsuario;
    private String observacoes;
    private List<ItemPedidoResponse> itens;
}