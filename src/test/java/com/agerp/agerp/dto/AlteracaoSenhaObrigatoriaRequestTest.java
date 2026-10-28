// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.dto;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AlteracaoSenhaObrigatoriaRequestTest {
    @Test
    void aplicaMesmoMinimoDeSeisCaracteresDoCadastro() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            AlteracaoSenhaObrigatoriaRequest troca = new AlteracaoSenhaObrigatoriaRequest();
            troca.setSenha("12345");
            troca.setConfirmacaoSenha("12345");
            UsuarioCreateRequest cadastro = new UsuarioCreateRequest("Nome", "a@b.com", "12345", 1);

            assertEquals(1, validator.validateProperty(troca, "senha").size());
            assertEquals(1, validator.validateProperty(cadastro, "senha").size());
        }
    }
}
