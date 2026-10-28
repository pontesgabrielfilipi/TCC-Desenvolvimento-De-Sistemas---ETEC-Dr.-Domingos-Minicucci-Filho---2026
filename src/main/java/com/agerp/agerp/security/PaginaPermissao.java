// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.security;

public enum PaginaPermissao {
    DASHBOARD, CLIENTES, PRODUTOS, PEDIDOS, ADMIN;

    public String authority() {
        return "PAGE_" + name();
    }
}
