package com.agerp.agerp.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MainController {

    /**
     * Endpoint simples para verificar se a API está rodando
     */
    @GetMapping("/")
    public String index() {
        return "API AGERP está rodando com sucesso!";
    }

    /**
     * Health Check (útil para React e ferramentas de monitoramento)
     */
    @GetMapping("/api/health")
    public String health() {
        return "OK";
    }

    /**
     * Endpoint de exemplo - pode ser removido depois
     */
    @GetMapping("/api/teste")
    public String teste() {
        return "Backend conectado ao React com sucesso!";
    }
}