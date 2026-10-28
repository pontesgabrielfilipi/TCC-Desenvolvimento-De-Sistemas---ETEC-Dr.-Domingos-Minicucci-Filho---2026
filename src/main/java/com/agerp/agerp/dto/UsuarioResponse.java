// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.dto;

import java.time.Instant;
import java.util.Set;

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
    private Set<String> paginas;
    private Integer nivelAutoridade;

    public UsuarioResponse(Integer id, String nome, String email, String perfilNome, Boolean ativo,
                           String statusAcesso, Boolean trocaSenhaObrigatoria, Integer idPerfil, Instant dataCriacao) {
        this.id = id;
        this.nome = nome;
        this.email = email;
        this.perfilNome = perfilNome;
        this.ativo = ativo;
        this.statusAcesso = statusAcesso;
        this.trocaSenhaObrigatoria = trocaSenhaObrigatoria;
        this.idPerfil = idPerfil;
        this.dataCriacao = dataCriacao;
    }

    public UsuarioResponse(Integer id, String nome, String email, String perfilNome, Boolean ativo) {
        this(id, nome, email, perfilNome, ativo, null, false, null, null);
    }

    public UsuarioResponse(Integer id, String nome, String email, String perfilNome, Boolean ativo,
                           String statusAcesso) {
        this(id, nome, email, perfilNome, ativo, statusAcesso, false, null, null);
    }
}
