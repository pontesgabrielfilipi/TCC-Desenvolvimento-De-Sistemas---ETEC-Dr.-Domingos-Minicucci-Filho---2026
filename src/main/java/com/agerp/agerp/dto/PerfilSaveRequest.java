package com.agerp.agerp.dto;

import jakarta.validation.constraints.*;
import java.util.Set;

public record PerfilSaveRequest(
        @NotBlank @Size(max = 100) String nome,
        @Size(max = 500) String descricao,
        @NotNull @Min(1) @Max(99) Integer nivelAutoridade,
        @NotNull Set<@NotBlank String> paginas,
        Long versao) {
}
