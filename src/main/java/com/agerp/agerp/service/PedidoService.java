package com.agerp.agerp.service;

import com.agerp.agerp.dto.*;
import com.agerp.agerp.entity.*;
import com.agerp.agerp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PedidoService {

    private final PedidoRepository pedidoRepository;
    private final ItemPedidoRepository itemPedidoRepository;
    private final ClienteRepository clienteRepository;
    private final ProdutoRepository produtoRepository;
    private final EstoqueRepository estoqueRepository;
    private final UsuarioRepository usuarioRepository;

    // ====================== TRANSIÇÕES DE STATUS VÁLIDAS ======================

    private static final Map<String, Set<String>> TRANSICOES_VALIDAS = Map.ofEntries(
            Map.entry("PENDENTE", Set.of("CONFIRMADO", "CANCELADO")),
            Map.entry("CONFIRMADO", Set.of("EM_PREPARACAO", "CANCELADO")),
            Map.entry("EM_PREPARACAO", Set.of("PRONTO", "CANCELADO")),
            Map.entry("PRONTO", Set.of("ENTREGUE", "CANCELADO")),
            Map.entry("ENTREGUE", Set.of()),  // Terminal, sem transições
            Map.entry("CANCELADO", Set.of()) // Terminal, sem transições
    );

    // ====================== LISTAR ======================

    @Cacheable(value = "pedidos", key = "#root.methodName")
    @Transactional(readOnly = true)
    public List<PedidoResponse> listarTodos() {
        return pedidoRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Cacheable(value = "pedidosPorStatus", key = "#status")
    @Transactional(readOnly = true)
    public List<PedidoResponse> listarPorStatus(String status) {
        if (!TRANSICOES_VALIDAS.containsKey(status)) {
            throw new IllegalArgumentException("Status inválido: " + status);
        }
        return pedidoRepository.findByStatus(status).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Cacheable(value = "pedidosPorCliente", key = "#idCliente")
    @Transactional(readOnly = true)
    public List<PedidoResponse> listarPorCliente(Integer idCliente) {
        clienteRepository.findById(idCliente)
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado com ID: " + idCliente));
        
        return pedidoRepository.findByIdCliente_Id(idCliente).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ====================== BUSCAR POR ID ======================

    @Cacheable(value = "pedidoPorId", key = "#id")
    @Transactional(readOnly = true)
    public PedidoResponse buscarPorId(Integer id) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado com ID: " + id));
        return toResponse(pedido);
    }

    // ====================== CRIAR ======================

    @Caching(evict = {
            @CacheEvict(cacheNames = "pedidos", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPorStatus", allEntries = true),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public PedidoResponse criar(PedidoCreateRequest request) {
        // ========== VALIDAÇÕES ==========

        // Validar cliente
        Cliente cliente = clienteRepository.findById(request.getIdCliente())
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado com ID: " + request.getIdCliente()));

        // Validar itens
        if (request.getItens() == null || request.getItens().isEmpty()) {
            throw new IllegalArgumentException("Pedido deve conter pelo menos um item");
        }

        // Validar produtos e estoque
        Map<Integer, ItemPedidoRequest> produtosUnicos = new HashMap<>();
        BigDecimal valorTotal = BigDecimal.ZERO;

        for (ItemPedidoRequest item : request.getItens()) {
            // Produto duplicado no mesmo pedido?
            if (produtosUnicos.containsKey(item.getIdProduto())) {
                throw new IllegalArgumentException("Produto duplicado no pedido (ID: " + item.getIdProduto() + ")");
            }
            produtosUnicos.put(item.getIdProduto(), item);

            // Produto existe?
            Produto produto = produtoRepository.findById(item.getIdProduto())
                    .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado com ID: " + item.getIdProduto()));

            // Produto ativo?
            if (!produto.getAtivo()) {
                throw new IllegalArgumentException("Produto inativo (ID: " + item.getIdProduto() + ")");
            }

            // Quantidade válida?
            if (item.getQuantidade() == null || item.getQuantidade() <= 0) {
                throw new IllegalArgumentException("Quantidade deve ser maior que zero (Produto ID: " + item.getIdProduto() + ")");
            }

            // Estoque suficiente?
            Estoque estoque = estoqueRepository.findByIdProduto_Id(item.getIdProduto())
                    .orElseThrow(() -> new IllegalArgumentException("Estoque não encontrado para produto ID: " + item.getIdProduto()));

            if (estoque.getQuantidadeAtual() < item.getQuantidade()) {
                throw new IllegalArgumentException(
                        "Estoque insuficiente para produto '" + produto.getNome() + "'. " +
                        "Disponível: " + estoque.getQuantidadeAtual() + ", " +
                        "Solicitado: " + item.getQuantidade()
                );
            }

            // Somar ao total
            BigDecimal subtotal = produto.getPreco().multiply(new BigDecimal(item.getQuantidade()));
            valorTotal = valorTotal.add(subtotal);
        }

        // ========== CRIAR PEDIDO ==========

        Pedido pedido = new Pedido();
        pedido.setIdCliente(cliente);
        pedido.setDataPedido(Instant.now());
        pedido.setStatus("PENDENTE");
        pedido.setValorTotal(valorTotal);
        pedido.setIdUsuario(obterUsuarioAtual());

        pedido = pedidoRepository.save(pedido);

        // ========== CRIAR ITENS ==========

        for (ItemPedidoRequest itemRequest : request.getItens()) {
            Produto produto = produtoRepository.findById(itemRequest.getIdProduto()).get();
            
            ItemPedido item = new ItemPedido();
            item.setIdPedido(pedido);
            item.setIdProduto(produto);
            item.setQuantidade(itemRequest.getQuantidade());
            item.setPrecoUnitario(produto.getPreco());
            
            itemPedidoRepository.save(item);
        }

        return toResponse(pedido);
    }

    // ====================== ATUALIZAR ======================

    @Caching(evict = {
            @CacheEvict(cacheNames = "pedidos", allEntries = true),
            @CacheEvict(cacheNames = "pedidoPorId", key = "#id"),
            @CacheEvict(cacheNames = "pedidosPorStatus", allEntries = true),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public PedidoResponse atualizar(Integer id, PedidoUpdateRequest request) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado com ID: " + id));

        // Apenas pedidos PENDENTES podem ser editados
        if (!"PENDENTE".equals(pedido.getStatus())) {
            throw new IllegalArgumentException("Apenas pedidos PENDENTES podem ser editados. Status atual: " + pedido.getStatus());
        }

        // Validar cliente
        Cliente cliente = clienteRepository.findById(request.getIdCliente())
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado com ID: " + request.getIdCliente()));

        // Validar itens (mesma lógica da criação)
        if (request.getItens() == null || request.getItens().isEmpty()) {
            throw new IllegalArgumentException("Pedido deve conter pelo menos um item");
        }

        Map<Integer, ItemPedidoRequest> produtosUnicos = new HashMap<>();
        BigDecimal valorTotal = BigDecimal.ZERO;

        for (ItemPedidoRequest item : request.getItens()) {
            if (produtosUnicos.containsKey(item.getIdProduto())) {
                throw new IllegalArgumentException("Produto duplicado no pedido (ID: " + item.getIdProduto() + ")");
            }
            produtosUnicos.put(item.getIdProduto(), item);

            Produto produto = produtoRepository.findById(item.getIdProduto())
                    .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado com ID: " + item.getIdProduto()));

            if (!produto.getAtivo()) {
                throw new IllegalArgumentException("Produto inativo (ID: " + item.getIdProduto() + ")");
            }

            if (item.getQuantidade() == null || item.getQuantidade() <= 0) {
                throw new IllegalArgumentException("Quantidade deve ser maior que zero (Produto ID: " + item.getIdProduto() + ")");
            }

            Estoque estoque = estoqueRepository.findByIdProduto_Id(item.getIdProduto())
                    .orElseThrow(() -> new IllegalArgumentException("Estoque não encontrado para produto ID: " + item.getIdProduto()));

            if (estoque.getQuantidadeAtual() < item.getQuantidade()) {
                throw new IllegalArgumentException(
                        "Estoque insuficiente para produto '" + produto.getNome() + "'. " +
                        "Disponível: " + estoque.getQuantidadeAtual() + ", " +
                        "Solicitado: " + item.getQuantidade()
                );
            }

            BigDecimal subtotal = produto.getPreco().multiply(new BigDecimal(item.getQuantidade()));
            valorTotal = valorTotal.add(subtotal);
        }

        // Atualizar pedido
        pedido.setIdCliente(cliente);
        pedido.setValorTotal(valorTotal);

        // Remover itens antigos e adicionar novos
        itemPedidoRepository.deleteAll(pedido.getItens());
        pedido.getItens().clear();

        for (ItemPedidoRequest itemRequest : request.getItens()) {
            Produto produto = produtoRepository.findById(itemRequest.getIdProduto()).get();
            
            ItemPedido item = new ItemPedido();
            item.setIdPedido(pedido);
            item.setIdProduto(produto);
            item.setQuantidade(itemRequest.getQuantidade());
            item.setPrecoUnitario(produto.getPreco());
            
            itemPedidoRepository.save(item);
        }

        pedido = pedidoRepository.save(pedido);
        return toResponse(pedido);
    }

    // ====================== MUDAR STATUS ======================

    @Caching(evict = {
            @CacheEvict(cacheNames = "pedidos", allEntries = true),
            @CacheEvict(cacheNames = "pedidoPorId", key = "#id"),
            @CacheEvict(cacheNames = "pedidosPorStatus", allEntries = true),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public PedidoResponse mudarStatus(Integer id, String novoStatus) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado com ID: " + id));

        String statusAtual = pedido.getStatus();

        // Validar novo status
        if (!TRANSICOES_VALIDAS.containsKey(novoStatus)) {
            throw new IllegalArgumentException("Status inválido: " + novoStatus);
        }

        // Validar transição
        Set<String> transicoesPermitidas = TRANSICOES_VALIDAS.get(statusAtual);
        if (!transicoesPermitidas.contains(novoStatus)) {
            throw new IllegalArgumentException(
                    "Transição inválida de '" + statusAtual + "' para '" + novoStatus + "'. " +
                    "Transições permitidas: " + transicoesPermitidas
            );
        }

        // Atualizar status
        pedido.setStatus(novoStatus);
        pedido = pedidoRepository.save(pedido);

        return toResponse(pedido);
    }

    // ====================== CANCELAR ======================

    @Caching(evict = {
            @CacheEvict(cacheNames = "pedidos", allEntries = true),
            @CacheEvict(cacheNames = "pedidoPorId", key = "#id"),
            @CacheEvict(cacheNames = "pedidosPorStatus", allEntries = true),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public PedidoResponse cancelar(Integer id) {
        return mudarStatus(id, "CANCELADO");
    }

    // ====================== DELETAR (soft delete) ======================

    @Caching(evict = {
            @CacheEvict(cacheNames = "pedidos", allEntries = true),
            @CacheEvict(cacheNames = "pedidoPorId", key = "#id"),
            @CacheEvict(cacheNames = "pedidosPorStatus", allEntries = true),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public void deletarSoft(Integer id) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado com ID: " + id));

        // Soft delete = cancelar pedido se ainda não foi entregue
        if (!pedido.getStatus().equals("ENTREGUE")) {
            mudarStatus(id, "CANCELADO");
        }
    }

    // ====================== CONVERSOR DTO ======================

    private PedidoResponse toResponse(Pedido pedido) {
        List<ItemPedidoResponse> itens = pedido.getItens().stream()
                .map(item -> new ItemPedidoResponse(
                        item.getId(),
                        item.getIdProduto().getId(),
                        item.getIdProduto().getNome(),
                        item.getQuantidade(),
                        item.getPrecoUnitario(),
                        item.getPrecoUnitario().multiply(new BigDecimal(item.getQuantidade()))
                ))
                .collect(Collectors.toList());

        return PedidoResponse.builder()
                .id(pedido.getId())
                .idCliente(pedido.getIdCliente().getId())
                .nomeCliente(pedido.getIdCliente().getNomeRazao())
                .dataPedido(pedido.getDataPedido())
                .status(pedido.getStatus())
                .valorTotal(pedido.getValorTotal())
                .idUsuario(pedido.getIdUsuario() != null ? pedido.getIdUsuario().getId() : null)
                .nomeUsuario(pedido.getIdUsuario() != null ? pedido.getIdUsuario().getNome() : null)
                .itens(itens)
                .build();
    }

    // ====================== UTILITÁRIOS ======================

    private Usuario obterUsuarioAtual() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        
        String email = authentication.getName();
        return usuarioRepository.findByEmail(email).orElse(null);
    }
}
