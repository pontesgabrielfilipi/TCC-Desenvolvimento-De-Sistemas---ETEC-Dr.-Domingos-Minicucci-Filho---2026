// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "cliente", schema = "agerp")
public class Cliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cliente", nullable = false)
    private Integer id;

    @Size(max = 20)
    @Column(name = "tipo", length = 20)
    private String tipo;                    // ex: "FISICA", "JURIDICA"

    @Size(max = 200)
    @Column(name = "nome_razao", length = 200)
    private String nomeRazao;

    @Size(max = 20)
    @Column(name = "cpf_cnpj", length = 20)
    private String cpfCnpj;

    @Size(max = 150)
    @Column(name = "email", length = 150)
    private String email;

    @Size(max = 20)
    @Column(name = "telefone", length = 20)
    private String telefone;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "data_cadastro", updatable = false)
    private Instant dataCadastro = Instant.now();
}