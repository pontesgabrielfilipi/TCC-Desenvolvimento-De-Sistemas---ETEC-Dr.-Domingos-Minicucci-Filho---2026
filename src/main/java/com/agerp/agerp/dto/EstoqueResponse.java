// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EstoqueResponse {

    private Integer id;
    private Integer idProduto;
    private String nomeProduto;
    private Integer quantidadeAtual;
    private Integer quantidadeMinima;
    private String localizacao;
}
