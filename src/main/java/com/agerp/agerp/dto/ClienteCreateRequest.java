// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ClienteCreateRequest {

    private String tipo;           // FISICA ou JURIDICA

    @NotBlank
    @Size(max = 200)
    private String nomeRazao;

    @Size(max = 20)
    private String cpfCnpj;

    @Email
    @Size(max = 150)
    private String email;

    @Size(max = 20)
    private String telefone;
}
