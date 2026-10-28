package com.agerp.agerp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UsuarioUpdateRequest {

    @NotBlank
    @Size(min = 3, max = 150)
    private String nome;

    @NotBlank
    @Email
    @Size(max = 150)
    private String email;

    @NotNull
    private Integer idPerfil;
}
