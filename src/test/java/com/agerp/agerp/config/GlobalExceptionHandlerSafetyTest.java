package com.agerp.agerp.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerSafetyTest {
    @Test void erroInternoNaoVazaMensagemDeExcecao() {
        var handler = new GlobalExceptionHandler();
        var response = handler.handleServletAndIoException(
                new IOException("password=DO_NOT_EXPOSE jdbc:postgresql://private"));
        assertEquals(500, response.getStatusCode().value());
        String message = response.getBody().message();
        assertTrue(message.contains("Referência:"));
        assertFalse(message.contains("DO_NOT_EXPOSE"));
        assertFalse(message.contains("jdbc:"));
    }
}
