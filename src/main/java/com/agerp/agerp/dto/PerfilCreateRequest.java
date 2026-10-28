package com.agerp.agerp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PerfilCreateRequest {

    @NotBlank
    @Size(max = 100)
    private String nome;

    @Size(max = 500)
    private String descricao;
}
