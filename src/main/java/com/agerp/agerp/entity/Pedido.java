package com.agerp.agerp.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import jakarta.annotation.Nullable;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "pedido", schema = "agerp")
public class Pedido {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_pedido", nullable = false)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_cliente", nullable = false)
    private Cliente idCliente;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "data_pedido", updatable = false)
    private Instant dataPedido = Instant.now();

    @Size(max = 50)
    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "valor_total", precision = 12, scale = 2)
    private BigDecimal valorTotal;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario")
    private Usuario idUsuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_endereco")
    private Endereco idEndereco;

    @Size(max = 500)
    @Column(name = "observacoes", columnDefinition = "TEXT")
    private String observacoes;

    @OneToMany(mappedBy = "idPedido")
    private Set<ItemPedido> itens = new LinkedHashSet<>();
}