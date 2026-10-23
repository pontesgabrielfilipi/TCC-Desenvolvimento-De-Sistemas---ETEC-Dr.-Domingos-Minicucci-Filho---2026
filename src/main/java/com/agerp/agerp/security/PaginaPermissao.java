package com.agerp.agerp.security;

public enum PaginaPermissao {
    DASHBOARD, CLIENTES, PRODUTOS, PEDIDOS, ADMIN;

    public String authority() {
        return "PAGE_" + name();
    }
}
