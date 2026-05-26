// MovimentacaoEstoqueResponse.java
package com.agerp.agerp.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MovimentacaoEstoqueResponse {

    private Integer id;
    private Integer idProduto;
    private String nomeProduto;
    private String tipo;
    private Integer quantidade;
    private Instant dataMovimentacao;
    private Integer idUsuario;
}