package com.agerp.agerp.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "sessao_autenticacao", schema = "agerp")
public class SessaoAutenticacao {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_usuario", nullable = false)
    private Usuario usuario;
    @Column(name = "device_ref") private UUID deviceRef;
    @Column(name = "criada_em", nullable = false) private Instant criadaEm;
    @Column(name = "expira_em", nullable = false) private Instant expiraEm;
    @Column(name = "revogada_em") private Instant revogadaEm;
    @Column(name = "motivo_revogacao", length = 40) private String motivoRevogacao;
}
