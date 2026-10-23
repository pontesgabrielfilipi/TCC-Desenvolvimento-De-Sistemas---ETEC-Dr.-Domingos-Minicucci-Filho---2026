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
    private Integer idUsuario;
    private String nomeUsuario;
    private String emailUsuario;
    private String perfilUsuario;
    private String recursoId;
    private String resultado;
    private String detalhes;
}
