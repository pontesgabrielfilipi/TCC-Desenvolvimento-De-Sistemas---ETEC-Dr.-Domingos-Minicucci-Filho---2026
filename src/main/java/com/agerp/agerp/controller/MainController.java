package com.agerp.agerp.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MainController {

    @GetMapping("/")
    public String index() {
        return "API AGERP está rodando com sucesso!";
    }

    @GetMapping("/api/health")
    public String health() {
        return "OK";
    }

    @GetMapping("/api/teste")
    public String teste() {
        return "Backend conectado ao React com sucesso!";
    }
}
