package com.agerp.agerp.service;

import com.agerp.agerp.dto.EnderecoCreateRequest;
import com.agerp.agerp.dto.EnderecoResponse;
import com.agerp.agerp.entity.Cliente;
import com.agerp.agerp.entity.Endereco;
import com.agerp.agerp.repository.ClienteRepository;
import com.agerp.agerp.repository.EnderecoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EnderecoService {

    private final EnderecoRepository enderecoRepository;
    private final ClienteRepository clienteRepository;

    @Cacheable(value = "enderecosPorCliente", key = "#clienteId")
    @Transactional(readOnly = true)
    public List<EnderecoResponse> listarPorCliente(Integer clienteId) {
        if (!clienteRepository.existsById(clienteId)) {
            throw new IllegalArgumentException("Cliente não encontrado com ID: " + clienteId);
        }
        return enderecoRepository.findByIdClienteId(clienteId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Cacheable(value = "enderecoPorId", key = "#id")
    @Transactional(readOnly = true)
    public EnderecoResponse buscarPorIdECliente(Integer clienteId, Integer id) {
        Endereco endereco = enderecoRepository.findByIdAndIdClienteId(id, clienteId)
                .orElseThrow(() -> new IllegalArgumentException("Endereço não encontrado com ID " + id + " para o cliente " + clienteId));
        return toResponse(endereco);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "enderecosPorCliente", key = "#clienteId"),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public EnderecoResponse criar(Integer clienteId, EnderecoCreateRequest request) {
        Cliente cliente = clienteRepository.findById(clienteId)
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado com ID: " + clienteId));

        Endereco endereco = new Endereco();
        endereco.setIdCliente(cliente);
        atualizarCampos(endereco, request);

        endereco = enderecoRepository.save(endereco);
        return toResponse(endereco);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "enderecosPorCliente", key = "#clienteId"),
            @CacheEvict(cacheNames = "enderecoPorId", key = "#id"),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public EnderecoResponse atualizar(Integer clienteId, Integer id, EnderecoCreateRequest request) {
        Endereco endereco = enderecoRepository.findByIdAndIdClienteId(id, clienteId)
                .orElseThrow(() -> new IllegalArgumentException("Endereço não encontrado com ID " + id + " para o cliente " + clienteId));

        atualizarCampos(endereco, request);

        endereco = enderecoRepository.save(endereco);
        return toResponse(endereco);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "enderecosPorCliente", key = "#clienteId"),
            @CacheEvict(cacheNames = "enderecoPorId", key = "#id"),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public void deletar(Integer clienteId, Integer id) {
        Endereco endereco = enderecoRepository.findByIdAndIdClienteId(id, clienteId)
                .orElseThrow(() -> new IllegalArgumentException("Endereço não encontrado com ID " + id + " para o cliente " + clienteId));

        enderecoRepository.delete(endereco);
    }

    private void atualizarCampos(Endereco endereco, EnderecoCreateRequest request) {
        endereco.setLogradouro(request.getLogradouro());
        endereco.setNumero(request.getNumero());
        endereco.setBairro(request.getBairro());
        endereco.setCidade(request.getCidade());
        endereco.setEstado(request.getEstado());
        endereco.setCep(request.getCep());
        endereco.setLatitude(request.getLatitude());
        endereco.setLongitude(request.getLongitude());
    }

    private EnderecoResponse toResponse(Endereco endereco) {
        return new EnderecoResponse(
                endereco.getId(),
                endereco.getIdCliente() != null ? endereco.getIdCliente().getId() : null,
                endereco.getLogradouro(),
                endereco.getNumero(),
                endereco.getBairro(),
                endereco.getCidade(),
                endereco.getEstado(),
                endereco.getCep(),
                endereco.getLatitude(),
                endereco.getLongitude()
        );
    }
}
