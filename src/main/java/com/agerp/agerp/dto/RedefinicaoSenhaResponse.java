// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.dto;

import java.time.Instant;

public record RedefinicaoSenhaResponse(String senhaTemporaria, Instant expiraEm) {}
