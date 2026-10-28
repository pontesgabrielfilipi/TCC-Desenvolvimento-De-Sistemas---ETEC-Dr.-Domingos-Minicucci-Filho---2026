// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PrevisaoEntregaResponse {

    private Integer idPedido;
    private Integer prazoMinimoDias;
    private Integer prazoMaximoDias;
    private Double estimativaCentralDias;
    private String status;
    private String cidadeOrigem;
    private String estadoOrigem;
    private String cidadeDestino;
    private String estadoDestino;
    private BigDecimal distanciaKm;
    private Instant dataCalculo;
    private String modeloVersao;
    private String mensagem;
}
