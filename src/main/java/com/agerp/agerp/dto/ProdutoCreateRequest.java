package com.agerp.agerp.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class ProdutoCreateRequest {

    @NotBlank
    @Size(max = 150)
    private String nome;

    private String descricao;

    @NotNull
    @Positive
    private BigDecimal preco;

    @NotNull
    private BigDecimal custo;

    @PositiveOrZero
    private BigDecimal peso;

    @PositiveOrZero
    private BigDecimal volume;

    private Integer quantidadeInicial = 0; // para criar estoque inicial
    private Integer quantidadeMinima = 10;
}