// UsuarioUpdateRequest.java
package com.agerp.agerp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UsuarioUpdateRequest {

    @Size(min = 3, max = 150)
    private String nome;

    @Email
    @Size(max = 150)
    private String email;

    private Integer idPerfil;
}