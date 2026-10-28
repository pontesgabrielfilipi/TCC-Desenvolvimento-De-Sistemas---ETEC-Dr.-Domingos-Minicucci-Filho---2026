package com.agerp.agerp.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "produto", schema = "agerp")
public class Produto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_produto", nullable = false)
    private Integer id;

    @Size(max = 150)
    @NotNull
    @Column(name = "nome", nullable = false, length = 150)
    private String nome;

    @Column(name = "descricao", columnDefinition = "TEXT")
    private String descricao;

    @Column(name = "preco", precision = 10, scale = 2)
    private BigDecimal preco;

    @Column(name = "custo", precision = 10, scale = 2)
    private BigDecimal custo;

    @Column(name = "peso", precision = 10, scale = 2)
    private BigDecimal peso;

    @Column(name = "volume", precision = 10, scale = 2)
    private BigDecimal volume;

    @ColumnDefault("true")
    @Column(name = "ativo")
    private Boolean ativo = true;

    @OneToOne(mappedBy = "idProduto", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Estoque estoque;
}
