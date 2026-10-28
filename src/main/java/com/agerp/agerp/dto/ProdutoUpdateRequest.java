// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.dto;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class ProdutoUpdateRequest {

    @Size(max = 150)
    private String nome;

    private String descricao;

    @Positive
    private BigDecimal preco;

    @PositiveOrZero
    private BigDecimal custo;

    @PositiveOrZero
    private BigDecimal peso;

    @PositiveOrZero
    private BigDecimal volume;

    private Boolean ativo;

    @PositiveOrZero
    private Integer quantidadeAtual;

    @PositiveOrZero
    private Integer quantidadeMinima;
}