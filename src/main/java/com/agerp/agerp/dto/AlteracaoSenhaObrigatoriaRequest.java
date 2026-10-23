package com.agerp.agerp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AlteracaoSenhaObrigatoriaRequest {
    @NotBlank(message = "Senha é obrigatória")
    @Size(min = 6, message = "Senha deve ter no mínimo 6 caracteres")
    private String senha;

    @NotBlank(message = "Confirmação da senha é obrigatória")
    @Size(min = 6, message = "Confirmação da senha deve ter no mínimo 6 caracteres")
    private String confirmacaoSenha;
}
