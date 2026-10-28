package com.agerp.agerp.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.Set;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PerfilResponse {

    private Integer id;
    private String nome;
    private String descricao;
    private Integer nivelAutoridade;
    private Boolean protegido;
    private Set<String> paginas;
    private Long versao;

    public PerfilResponse(Integer id, String nome, String descricao) {
        this.id = id;
        this.nome = nome;
        this.descricao = descricao;
    }
}
