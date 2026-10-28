package com.agerp.agerp.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ClienteResponse {

    private Integer id;
    private String tipo;
    private String nomeRazao;
    private String cpfCnpj;
    private String email;
    private String telefone;
    private Instant dataCadastro;
}
