package com.agerp.agerp.security;

import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.UsuarioRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UsuarioRepository usuarioRepository;

    public CustomUserDetailsService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Credenciais inválidas"));

        // Cria a autoridade no formato ROLE_XXXX
        String role = "ROLE_" + usuario.getIdPerfil().getNome().toUpperCase();

        return new CustomUserDetails(usuario, List.of(new SimpleGrantedAuthority(role)));
    }
}
