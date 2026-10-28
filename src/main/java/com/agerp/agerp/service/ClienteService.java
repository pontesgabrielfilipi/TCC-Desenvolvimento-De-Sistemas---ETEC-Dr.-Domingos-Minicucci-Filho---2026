package com.agerp.agerp.service;

import com.agerp.agerp.dto.ClienteCreateRequest;
import com.agerp.agerp.dto.ClienteResponse;
import com.agerp.agerp.entity.Cliente;
import com.agerp.agerp.repository.ClienteRepository;
import com.agerp.agerp.repository.EnderecoRepository;   // ← Adicionado
import com.agerp.agerp.repository.PedidoRepository;
import com.agerp.agerp.config.BusinessConflictException;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ClienteService {
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private AuditoriaNegocioService auditoria;

    private final ClienteRepository clienteRepository;
    private final EnderecoRepository enderecoRepository;   // ← Injetado
    private final PedidoRepository pedidoRepository;

    public ClienteService(ClienteRepository clienteRepository, EnderecoRepository enderecoRepository,
            PedidoRepository pedidoRepository) {
        this.clienteRepository = clienteRepository;
        this.enderecoRepository = enderecoRepository;
        this.pedidoRepository = pedidoRepository;
    }

    @Cacheable("clientes")
    @Transactional(readOnly = true)
    public List<ClienteResponse> listarTodos() {
        return clienteRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @CacheEvict(cacheNames = "clientes", allEntries = true, beforeInvocation = true)
    @Transactional(readOnly = true)
    public List<ClienteResponse> recarregarTodos() {
        return clienteRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Cacheable(value = "clientePorId", key = "#id")
    @Transactional(readOnly = true)
    public ClienteResponse buscarPorId(Integer id) {
        Cliente cliente = clienteRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado com ID: " + id));
        return toResponse(cliente);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "clientes", allEntries = true),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public ClienteResponse criar(ClienteCreateRequest request) {
        if (request.getCpfCnpj() != null && clienteRepository.existsByCpfCnpj(request.getCpfCnpj())) {
            throw new IllegalArgumentException("CPF/CNPJ já cadastrado.");
        }
        if (request.getEmail() != null && clienteRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("E-mail já cadastrado.");
        }

        Cliente cliente = new Cliente();
        cliente.setTipo(request.getTipo());
        cliente.setNomeRazao(request.getNomeRazao());
        cliente.setCpfCnpj(request.getCpfCnpj());
        cliente.setEmail(request.getEmail());
        cliente.setTelefone(request.getTelefone());

        cliente = clienteRepository.save(cliente);
        if (auditoria != null) auditoria.registrar("CRIACAO_CLIENTE", "CLIENTE", cliente.getId(),
                AuditoriaNegocioService.mudancas("tipo", null, cliente.getTipo()));
        return toResponse(cliente);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "clientes", allEntries = true),
            @CacheEvict(cacheNames = "clientePorId", key = "#id"),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public ClienteResponse atualizar(Integer id, ClienteCreateRequest request) {
        Cliente cliente = clienteRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado com ID: " + id));

        if (request.getCpfCnpj() != null && clienteRepository.existsByCpfCnpjAndIdNot(request.getCpfCnpj(), id)) {
            throw new BusinessConflictException("CPF/CNPJ já cadastrado para outro cliente.");
        }
        if (request.getEmail() != null && clienteRepository.existsByEmailIgnoreCaseAndIdNot(request.getEmail(), id)) {
            throw new BusinessConflictException("E-mail já cadastrado para outro cliente.");
        }

        Object tipoAnterior = cliente.getTipo();
        cliente.setNomeRazao(request.getNomeRazao().trim());
        cliente.setTipo(request.getTipo());
        cliente.setCpfCnpj(request.getCpfCnpj());
        cliente.setEmail(request.getEmail());
        cliente.setTelefone(request.getTelefone());

        cliente = clienteRepository.save(cliente);
        var alteracoes = AuditoriaNegocioService.mudancas("tipo", tipoAnterior, cliente.getTipo());
        if (auditoria != null && !alteracoes.isEmpty()) auditoria.registrar("EDICAO_CLIENTE", "CLIENTE", id, alteracoes);
        return toResponse(cliente);
    }


    @Caching(evict = {
            @CacheEvict(cacheNames = "clientes", allEntries = true),
            @CacheEvict(cacheNames = "clientePorId", key = "#id"),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public void deletar(Integer id) {
        if (!clienteRepository.existsById(id)) {
            throw new IllegalArgumentException("Cliente não encontrado com ID: " + id);
        }

        if (pedidoRepository.existsByIdCliente_Id(id)) {
            throw new BusinessConflictException(
                    "Cliente possui pedidos vinculados e não pode ser excluído. Preserve o histórico comercial.");
        }

        // Sem histórico de pedidos, os endereços cadastrais podem ser removidos com o cliente.
        enderecoRepository.deleteByIdCliente_Id(id);

        clienteRepository.deleteById(id);
        if (auditoria != null) auditoria.registrar("EXCLUSAO_CLIENTE", "CLIENTE", id, java.util.Map.of());
    }

    private ClienteResponse toResponse(Cliente cliente) {
        return new ClienteResponse(
                cliente.getId(),
                cliente.getTipo(),
                cliente.getNomeRazao(),
                cliente.getCpfCnpj(),
                cliente.getEmail(),
                cliente.getTelefone(),
                cliente.getDataCadastro()
        );
    }
}
