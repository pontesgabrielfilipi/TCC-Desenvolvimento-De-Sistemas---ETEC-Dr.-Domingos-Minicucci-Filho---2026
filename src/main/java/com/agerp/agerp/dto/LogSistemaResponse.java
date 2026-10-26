package com.agerp.agerp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LogSistemaResponse {

    public LogSistemaResponse(Integer id, String acao, String entidade, Instant dataHora, String ip,
            Integer idUsuario, String nomeUsuario, String emailUsuario, String perfilUsuario,
            String recursoId, String resultado, String detalhes) {
        this.id = id; this.acao = acao; this.entidade = entidade; this.dataHora = dataHora;
        this.ip = ip; this.idUsuario = idUsuario; this.nomeUsuario = nomeUsuario;
        this.emailUsuario = emailUsuario; this.perfilUsuario = perfilUsuario;
        this.recursoId = recursoId; this.resultado = resultado; this.detalhes = detalhes;
    }

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
    private String requestId;
    private String sessionRef;
    private String deviceRef;
    private String correlationId;
    private String userAgent;
    private String peerIp;
    private String httpMethod;
    private String httpRoute;
    private Integer httpStatus;
    private Map<String, Object> changesJson;
    private String origemConfianca;
    private boolean identidadeHistoricaConfirmada;
}
