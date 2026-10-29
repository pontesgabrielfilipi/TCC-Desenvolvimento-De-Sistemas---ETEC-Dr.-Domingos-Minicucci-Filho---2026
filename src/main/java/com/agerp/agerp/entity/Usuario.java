// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "usuario", schema = "agerp")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_usuario", nullable = false)
    private Integer id;

    @Size(max = 150)
    @NotNull
    @Column(name = "nome", nullable = false, length = 150)
    private String nome;

    @Size(max = 150)
    @NotNull
    @Column(name = "email", nullable = false, length = 150, unique = true)
    private String email;

    @NotNull
    @Column(name = "senha_hash", nullable = false)
    private String senhaHash;

    @NotNull
    @Column(name = "credential_version", nullable = false)
    private Long credentialVersion = 0L;

    @NotNull
    @Column(name = "troca_senha_obrigatoria", nullable = false)
    private Boolean trocaSenhaObrigatoria = false;

    @Column(name = "credencial_temporaria_hash")
    private String credencialTemporariaHash;

    @Column(name = "credencial_temporaria_expira_em")
    private Instant credencialTemporariaExpiraEm;

    @Column(name = "credencial_temporaria_usada_em")
    private Instant credencialTemporariaUsadaEm;

    @ColumnDefault("true")
    @Column(name = "ativo")
    private Boolean ativo = true;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status_acesso", nullable = false, length = 20)
    private StatusAcesso statusAcesso = StatusAcesso.PENDENTE;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "data_criacao", updatable = false)
    private Instant dataCriacao;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_perfil", nullable = false)
    private Perfil idPerfil;

    @OneToMany(mappedBy = "idUsuario")
    private Set<LogSistema> logSistemas = new LinkedHashSet<>();

    @OneToMany(mappedBy = "idUsuario")
    private Set<MovimentacaoEstoque> movimentacaoEstoques = new LinkedHashSet<>();

    @OneToMany(mappedBy = "idUsuario")
    private Set<Pedido> pedidos = new LinkedHashSet<>();

    public boolean isAtivo() {
        return Boolean.TRUE.equals(this.ativo);
    }

    public String getSenha() {
        return this.senhaHash;
    }
}
