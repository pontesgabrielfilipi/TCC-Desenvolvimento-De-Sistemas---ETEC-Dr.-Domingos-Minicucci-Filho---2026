// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import java.util.LinkedHashSet;
import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "perfil", schema = "agerp")
public class Perfil {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_perfil", nullable = false)
    private Integer id;

    @Size(max = 100)
    @NotNull
    @Column(name = "nome", nullable = false, length = 100)
    private String nome;

    @Column(name = "descricao", columnDefinition = "TEXT")
    private String descricao;

    @Column(name = "nivel_autoridade", nullable = false)
    private Integer nivelAutoridade = 20;

    @Column(name = "protegido", nullable = false)
    private Boolean protegido = false;

    @Version
    @Column(name = "versao", nullable = false)
    private Long versao;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "perfil_pagina", schema = "agerp", joinColumns = @JoinColumn(name = "id_perfil"))
    @Column(name = "pagina", nullable = false)
    private Set<String> paginas = new LinkedHashSet<>();
}
