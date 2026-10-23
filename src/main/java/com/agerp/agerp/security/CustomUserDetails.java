package com.agerp.agerp.security;

import com.agerp.agerp.entity.Usuario;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.util.Collection;

@Getter
public class CustomUserDetails extends User {

    private final Usuario usuario;

    public CustomUserDetails(Usuario usuario, Collection<? extends GrantedAuthority> authorities) {
        super(
                usuario.getEmail(),                    // username
                Boolean.TRUE.equals(usuario.getTrocaSenhaObrigatoria())
                        && usuario.getCredencialTemporariaHash() != null
                        ? usuario.getCredencialTemporariaHash() : usuario.getSenhaHash(),
                authorities
        );
        this.usuario = usuario;
    }
}
