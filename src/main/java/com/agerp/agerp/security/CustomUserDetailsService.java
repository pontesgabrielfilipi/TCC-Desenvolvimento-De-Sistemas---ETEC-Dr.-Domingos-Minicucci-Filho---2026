package com.agerp.agerp.security;

import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UsuarioRepository usuarioRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        System.out.println("Buscando usuário: " + email);

        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado: " + email));

        if (!usuario.isAtivo()) {
            throw new UsernameNotFoundException("Usuário inativo: " + email);
        }

        // Cria a autoridade no formato ROLE_XXXX
        String role = "ROLE_" + usuario.getIdPerfil().getNome().toUpperCase();

        return new CustomUserDetails(usuario, List.of(new SimpleGrantedAuthority(role)));
    }
}