package com.agerp.agerp.dto;

import java.time.Instant;

public record RedefinicaoSenhaResponse(String senhaTemporaria, Instant expiraEm) {}
