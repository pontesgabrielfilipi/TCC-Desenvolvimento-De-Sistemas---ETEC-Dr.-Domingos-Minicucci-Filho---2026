package com.agerp.agerp.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import jakarta.servlet.ServletException;
import java.io.IOException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    // ====================== RESPOSTA PADRÃO (compatível com seu React) ======================
    public record ErrorResponse(String message) {}

    // 1. IllegalArgumentException → 400 Bad Request (o que você mais usa)
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(ex.getMessage()));
    }

    // 2. UsernameNotFoundException → 404 Not Found
    @ExceptionHandler(UsernameNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleUsernameNotFound(UsernameNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(ex.getMessage()));
    }

    // 3. AuthenticationException → 401 Unauthorized (login, JWT, etc.)
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthenticationException(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ErrorResponse(
                        ex.getMessage() != null ? ex.getMessage() : "Credenciais inválidas"
                ));
    }

    // 4. ServletException e IOException (dos filtros que aparecem nas imagens)
    @ExceptionHandler({ServletException.class, IOException.class})
    public ResponseEntity<ErrorResponse> handleServletAndIoException(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Erro de processamento: " + ex.getMessage()));
    }

    // 5. Catch-all para qualquer outra exceção não tratada
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
        // ex.printStackTrace(); // descomente em desenvolvimento para ver o stack no console
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("Ocorreu um erro inesperado no servidor. Tente novamente mais tarde."));
    }
}