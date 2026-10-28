// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp;

import org.springframework.boot.SpringApplication;

public class TestAgEstudosApplication {

    public static void main(String[] args) {
        SpringApplication.from(AgerpApplication::main).with(TestcontainersConfiguration.class).run(args);
    }

}
