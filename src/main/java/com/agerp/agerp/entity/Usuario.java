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

    @ColumnDefault("true")
    @Column(name = "ativo")
    private Boolean ativo = true;

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

    // ==================== MÉTODO CORRIGIDO ====================
    public boolean isAtivo() {
        return Boolean.TRUE.equals(this.ativo);
    }

    // Alias para facilitar o Spring Security
    public String getSenha() {
        return this.senhaHash;
    }
}