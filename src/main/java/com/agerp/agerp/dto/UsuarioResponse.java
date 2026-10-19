// UsuarioResponse.java
package com.agerp.agerp.dto;

import java.time.Instant;

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
    private String statusAcesso;
    private Boolean trocaSenhaObrigatoria;
    private Integer idPerfil;
    private Instant dataCriacao;

    public UsuarioResponse(Integer id, String nome, String email, String perfilNome, Boolean ativo) {
        this(id, nome, email, perfilNome, ativo, null, false, null, null);
    }

    public UsuarioResponse(Integer id, String nome, String email, String perfilNome, Boolean ativo,
                           String statusAcesso) {
        this(id, nome, email, perfilNome, ativo, statusAcesso, false, null, null);
    }
}
