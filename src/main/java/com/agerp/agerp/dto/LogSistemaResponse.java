package com.agerp.agerp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LogSistemaResponse {

    private Integer id;
    private String acao;
    private String entidade;
    private Instant dataHora;
    private String ip;
    private String nomeUsuario;   // só o nome, para não carregar a entidade completa
}