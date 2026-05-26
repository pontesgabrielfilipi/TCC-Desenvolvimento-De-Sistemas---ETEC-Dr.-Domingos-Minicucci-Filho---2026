package com.agerp.agerp.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProdutoResponse {

    private Integer id;
    private String nome;
    private String descricao;
    private BigDecimal preco;
    private BigDecimal custo;
    private BigDecimal peso;
    private BigDecimal volume;
    private Boolean ativo;
    private Integer quantidadeAtual;
    private Integer quantidadeMinima;
    private String localizacao;
}