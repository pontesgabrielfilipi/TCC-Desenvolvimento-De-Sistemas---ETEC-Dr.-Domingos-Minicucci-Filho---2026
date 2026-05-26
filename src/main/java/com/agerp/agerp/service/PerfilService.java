package com.agerp.agerp.service;

import com.agerp.agerp.dto.PerfilCreateRequest;
import com.agerp.agerp.dto.PerfilResponse;
import com.agerp.agerp.entity.Perfil;
import com.agerp.agerp.repository.PerfilRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PerfilService {

    private final PerfilRepository perfilRepository;

    /**
     * Cria um novo perfil
     */
    @Transactional
    public PerfilResponse criar(PerfilCreateRequest request) {
        if (perfilRepository.findByNome(request.getNome().trim().toUpperCase()).isPresent()) {
            throw new IllegalArgumentException("Já existe um perfil com o nome: " + request.getNome());
        }

        Perfil perfil = new Perfil();
        perfil.setNome(request.getNome().trim().toUpperCase());  // padroniza em maiúsculo
        perfil.setDescricao(request.getDescricao());

        perfil = perfilRepository.save(perfil);

        return new PerfilResponse(perfil.getId(), perfil.getNome(), perfil.getDescricao());
    }

    /**
     * Lista todos os perfis
     */
    @Transactional(readOnly = true)
    public List<PerfilResponse> listarTodos() {
        return perfilRepository.findAll().stream()
                .map(perfil -> new PerfilResponse(
                        perfil.getId(),
                        perfil.getNome(),
                        perfil.getDescricao()))
                .toList();
    }

    /**
     * Busca perfil por ID
     */
    @Transactional(readOnly = true)
    public PerfilResponse buscarPorId(Integer id) {
        Perfil perfil = perfilRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado com ID: " + id));

        return new PerfilResponse(perfil.getId(), perfil.getNome(), perfil.getDescricao());
    }

    /**
     * Busca perfil por nome (útil para seed e validações)
     */
    @Transactional(readOnly = true)
    public PerfilResponse buscarPorNome(String nome) {
        Perfil perfil = perfilRepository.findByNome(nome)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado: " + nome));

        return new PerfilResponse(perfil.getId(), perfil.getNome(), perfil.getDescricao());
    }
}