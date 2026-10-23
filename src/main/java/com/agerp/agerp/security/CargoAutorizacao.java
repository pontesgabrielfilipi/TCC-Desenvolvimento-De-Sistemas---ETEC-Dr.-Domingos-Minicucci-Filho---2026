package com.agerp.agerp.security;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * Avalia operações operacionais privilegiadas usando o perfil carregado do banco
 * nesta requisição. A hierarquia não substitui a permissão explícita da página.
 */
@Component("cargoAutorizacao")
public class CargoAutorizacao {

    public boolean nivelMinimo(Authentication authentication, int minimo) {
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserDetails details)
                || details.getUsuario().getIdPerfil() == null) {
            return false;
        }
        Integer nivel = details.getUsuario().getIdPerfil().getNivelAutoridade();
        return nivel != null && nivel >= minimo;
    }

    public boolean podeAlterarStatusPedido(Authentication authentication, String status) {
        return !"CANCELADO".equalsIgnoreCase(status == null ? "" : status.trim())
                || nivelMinimo(authentication, 60);
    }
}
