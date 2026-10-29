// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "pagamento", schema = "agerp")
public class Pagamento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_pagamento", nullable = false)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_pedido", nullable = false)
    private Pedido idPedido;

    @Size(max = 50)
    @Column(name = "tipo_pagamento", length = 50)
    private String tipoPagamento;

    @Column(name = "valor", precision = 10, scale = 2)
    private BigDecimal valor;

    @Size(max = 50)
    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "data_pagamento")
    private Instant dataPagamento;
}