// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;
import java.util.UUID;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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

    @Column(name = "event_id", updatable = false)
    private UUID eventId;
    @Column(name = "request_id", updatable = false)
    private UUID requestId;
    @Column(name = "correlation_id", length = 64, updatable = false)
    private String correlationId;
    @Column(name = "session_ref", length = 100, updatable = false)
    private String sessionRef;
    @Column(name = "device_ref", length = 100, updatable = false)
    private String deviceRef;
    @Column(name = "event_schema_version", nullable = false, updatable = false)
    private short eventSchemaVersion = 1;
    @Column(name = "peer_ip", length = 50, updatable = false)
    private String peerIp;
    @Column(name = "user_agent", length = 256, updatable = false)
    private String userAgent;
    @Column(name = "http_method", length = 10, updatable = false)
    private String httpMethod;
    @Column(name = "http_route", length = 160, updatable = false)
    private String httpRoute;
    @Column(name = "http_status", updatable = false)
    private Integer httpStatus;
    @Column(name = "duration_ms", updatable = false)
    private Long durationMs;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "changes_json", columnDefinition = "jsonb", updatable = false)
    private Map<String, Object> changesJson;
}
