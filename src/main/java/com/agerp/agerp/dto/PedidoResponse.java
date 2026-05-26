// PedidoResponse.java
package com.agerp.agerp.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PedidoResponse {

    private Integer id;
    private Integer idCliente;
    private String nomeCliente;
    private Instant dataPedido;
    private String status;
    private BigDecimal valorTotal;
    private Integer idUsuario;
}