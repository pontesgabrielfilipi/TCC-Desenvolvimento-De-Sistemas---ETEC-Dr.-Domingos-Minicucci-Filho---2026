package com.agerp.agerp.security;

import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.UsuarioRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.ArrayList;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UsuarioRepository usuarioRepository;

    public CustomUserDetailsService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Credenciais inválidas"));

        // Cria a autoridade no formato ROLE_XXXX
        String role = "ROLE_" + usuario.getIdPerfil().getNome().toUpperCase();

        var authorities = new ArrayList<SimpleGrantedAuthority>();
        authorities.add(new SimpleGrantedAuthority(role));
        if ("ADMIN".equalsIgnoreCase(usuario.getIdPerfil().getNome())) {
            for (PaginaPermissao p : PaginaPermissao.values()) authorities.add(new SimpleGrantedAuthority(p.authority()));
        } else {
            for (String pagina : usuario.getIdPerfil().getPaginas()) {
                try {
                    PaginaPermissao p = PaginaPermissao.valueOf(pagina);
                    if (p != PaginaPermissao.ADMIN) authorities.add(new SimpleGrantedAuthority(p.authority()));
                } catch (IllegalArgumentException ignored) {
                    // A migração garante valores conhecidos; dados inesperados não concedem acesso.
                }
            }
        }
        return new CustomUserDetails(usuario, authorities);
    }
}
