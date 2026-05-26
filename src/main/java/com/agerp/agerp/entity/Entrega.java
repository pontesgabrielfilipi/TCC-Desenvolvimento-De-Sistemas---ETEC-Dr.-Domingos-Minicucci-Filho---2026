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
@Table(name = "entrega", schema = "agerp")
public class Entrega {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_entrega", nullable = false)
    private Integer id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_pedido", nullable = false, unique = true)
    private Pedido idPedido;

    @Column(name = "data_saida")
    private Instant dataSaida;

    @Column(name = "data_entrega")
    private Instant dataEntrega;

    @Size(max = 50)
    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "tempo_estimado_ia")
    private Integer tempoEstimadoIa;

    @Column(name = "tempo_real")
    private Integer tempoReal;

    @Column(name = "distancia_km", precision = 10, scale = 2)
    private BigDecimal distanciaKm;
}