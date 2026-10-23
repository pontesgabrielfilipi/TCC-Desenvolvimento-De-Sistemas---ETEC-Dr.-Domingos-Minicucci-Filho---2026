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
    @PositiveOrZero
    private BigDecimal custo;

    @PositiveOrZero
    private BigDecimal peso;

    @PositiveOrZero
    private BigDecimal volume;

    @PositiveOrZero
    private Integer quantidadeInicial = 0; // unidades inteiras
    @PositiveOrZero
    private Integer quantidadeMinima = 10;
}
