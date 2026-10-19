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
@Table(name = "log_sistema", schema = "agerp")
public class LogSistema {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_log", nullable = false)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_usuario")
    private Usuario idUsuario;

    @Size(max = 100)
    @Column(name = "acao", length = 100)
    private String acao;

    @Size(max = 100)
    @Column(name = "entidade", length = 100)
    private String entidade;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "data_hora", updatable = false)
    private Instant dataHora = Instant.now();

    @Size(max = 50)
    @Column(name = "ip", length = 50)
    private String ip;

    @Size(max = 150)
    @Column(name = "usuario_nome", length = 150)
    private String usuarioNome;

    @Size(max = 255)
    @Column(name = "usuario_email", length = 255)
    private String usuarioEmail;

    @Size(max = 100)
    @Column(name = "usuario_perfil", length = 100)
    private String usuarioPerfil;

    @Size(max = 100)
    @Column(name = "recurso_id", length = 100)
    private String recursoId;

    @Size(max = 50)
    @Column(name = "resultado", length = 50)
    private String resultado;

    @Column(name = "detalhes", columnDefinition = "TEXT")
    private String detalhes;
}
