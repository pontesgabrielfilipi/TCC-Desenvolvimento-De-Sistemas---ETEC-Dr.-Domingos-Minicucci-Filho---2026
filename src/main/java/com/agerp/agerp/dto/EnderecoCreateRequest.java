package com.agerp.agerp.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class EnderecoCreateRequest {

    @Size(max = 200, message = "Logradouro deve ter no máximo 200 caracteres")
    private String logradouro;

    @Size(max = 20, message = "Número deve ter no máximo 20 caracteres")
    private String numero;

    @Size(max = 100, message = "Bairro deve ter no máximo 100 caracteres")
    private String bairro;

    @Size(max = 100, message = "Cidade deve ter no máximo 100 caracteres")
    private String cidade;

    @Size(max = 50, message = "Estado deve ter no máximo 50 caracteres")
    private String estado;

    @Size(max = 20, message = "CEP deve ter no máximo 20 caracteres")
    private String cep;

    private BigDecimal latitude;

    private BigDecimal longitude;
}
