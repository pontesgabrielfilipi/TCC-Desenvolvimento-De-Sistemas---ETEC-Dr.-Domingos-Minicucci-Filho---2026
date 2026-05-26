package com.agerp.agerp;

import org.springframework.boot.SpringApplication;

public class TestAgEstudosApplication {

    public static void main(String[] args) {
        SpringApplication.from(AgerpApplication::main).with(TestcontainersConfiguration.class).run(args);
    }

}
