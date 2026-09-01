package com.agerp.agerp.service;

import com.agerp.agerp.dto.UsuarioCreateRequest;
import com.agerp.agerp.dto.UsuarioResponse;
import com.agerp.agerp.dto.UsuarioUpdateRequest;
import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.entity.Usuario;
import com.agerp.agerp.repository.PerfilRepository;
import com.agerp.agerp.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final PerfilRepository perfilRepository;
    private final PasswordEncoder passwordEncoder;

    @Caching(evict = {
            @CacheEvict(cacheNames = "usuarios", allEntries = true),
            @CacheEvict(cacheNames = "usuariosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true)
    })
    @Transactional
    public UsuarioResponse criar(UsuarioCreateRequest request) {
        if (usuarioRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Este email já está cadastrado no sistema.");
        }

        Perfil perfil = perfilRepository.findById(request.getIdPerfil())
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado. ID: " + request.getIdPerfil()));

        Usuario usuario = new Usuario();
        usuario.setNome(request.getNome());
        usuario.setEmail(request.getEmail());
        usuario.setSenhaHash(passwordEncoder.encode(request.getSenha()));
        usuario.setIdPerfil(perfil);
        usuario.setAtivo(true);

        usuario = usuarioRepository.save(usuario);
        return toResponse(usuario);
    }

    @Cacheable("usuarios")
    @Transactional(readOnly = true)
    public List<UsuarioResponse> listarTodos() {
        return usuarioRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Cacheable("usuariosAtivos")
    @Transactional(readOnly = true)
    public List<UsuarioResponse> listarAtivos() {
        return usuarioRepository.findByAtivoTrue().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Cacheable(value = "usuarioPorId", key = "#id")
    @Transactional(readOnly = true)
    public UsuarioResponse buscarPorId(Integer id) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado. ID: " + id));
        return toResponse(usuario);
    }

    @Cacheable(value = "usuarioPorEmail", key = "#email")
    @Transactional(readOnly = true)
    public UsuarioResponse buscarPorEmail(String email) {
        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado com o email: " + email));
        return toResponse(usuario);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "usuarios", allEntries = true),
            @CacheEvict(cacheNames = "usuariosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "usuarioPorId", key = "#id"),
            @CacheEvict(cacheNames = "usuarioPorEmail", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true)
    })
    @Transactional
    public UsuarioResponse atualizar(Integer id, UsuarioUpdateRequest request) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado. ID: " + id));

        if (request.getNome() != null && !request.getNome().isBlank()) {
            usuario.setNome(request.getNome());
        }
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            if (!request.getEmail().equals(usuario.getEmail()) &&
                    usuarioRepository.existsByEmail(request.getEmail())) {
                throw new IllegalArgumentException("Este email já está em uso.");
            }
            usuario.setEmail(request.getEmail());
        }
        if (request.getIdPerfil() != null) {
            Perfil perfil = perfilRepository.findById(request.getIdPerfil())
                    .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado. ID: " + request.getIdPerfil()));
            usuario.setIdPerfil(perfil);
        }

        usuario = usuarioRepository.save(usuario);
        return toResponse(usuario);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "usuarios", allEntries = true),
            @CacheEvict(cacheNames = "usuariosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "usuarioPorId", key = "#id"),
            @CacheEvict(cacheNames = "usuarioPorEmail", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true)
    })
    @Transactional
    public void deletar(Integer id) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado. ID: " + id));
        usuario.setAtivo(false);
        usuarioRepository.save(usuario);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "usuarios", allEntries = true),
            @CacheEvict(cacheNames = "usuariosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "usuarioPorId", key = "#id"),
            @CacheEvict(cacheNames = "usuarioPorEmail", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true)
    })
    @Transactional
    public void deletarPermanente(Integer id) {
        if (!usuarioRepository.existsById(id)) {
            throw new IllegalArgumentException("Usuário não encontrado. ID: " + id);
        }
        usuarioRepository.deleteById(id);
    }

    private UsuarioResponse toResponse(Usuario usuario) {
        return new UsuarioResponse(
                usuario.getId(),
                usuario.getNome(),
                usuario.getEmail(),
                usuario.getIdPerfil() != null ? usuario.getIdPerfil().getNome() : null,
                usuario.getAtivo()
        );
    }

    public long countTotalUsuarios() {
        return usuarioRepository.count();
    }

    public long countUsuariosAtivos() {
        return usuarioRepository.countByAtivoTrue();
    }
}
