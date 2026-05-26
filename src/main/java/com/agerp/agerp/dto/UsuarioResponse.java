// UsuarioResponse.java
package com.agerp.agerp.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UsuarioResponse {

    private Integer id;
    private String nome;
    private String email;
    private String perfilNome;
    private Boolean ativo;
}