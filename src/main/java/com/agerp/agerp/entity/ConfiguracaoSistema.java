package com.agerp.agerp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Getter
@Setter
@Table(name = "configuracao_sistema", schema = "agerp")
public class ConfiguracaoSistema {
    @Id
    private Integer id;

    @Column(name = "nome_empresa", nullable = false, length = 100)
    private String nomeEmpresa;

    @Column(name = "limite_estoque_baixo", nullable = false)
    private Integer limiteEstoqueBaixo;

    @Column(name = "exibir_alertas_estoque", nullable = false)
    private Boolean exibirAlertasEstoque;

    @Column(name = "timeout_ia_ms", nullable = false)
    private Integer timeoutIaMs;

    @Version
    @Column(name = "versao", nullable = false)
    private Long versao;

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;
}
