// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "estoque", schema = "agerp")
public class Estoque {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_estoque", nullable = false)
    private Integer id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_produto", nullable = false, unique = true)
    private Produto idProduto;

    @Column(name = "quantidade_atual")
    private Integer quantidadeAtual;

    @Column(name = "quantidade_minima")
    private Integer quantidadeMinima;

    @Size(max = 100)
    @Column(name = "localizacao", length = 100)
    private String localizacao;
}