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
    private final MovimentacaoEstoqueRepository movimentacaoEstoqueRepository;
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
            @CacheEvict(cacheNames = "pedidosPorCliente", allEntries = true),
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

        // Validar produtos e checar disponibilidade de estoque
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
            if (produto.getAtivo() != null && !produto.getAtivo()) {
                throw new IllegalArgumentException("Produto inativo (ID: " + item.getIdProduto() + ")");
            }

            // Quantidade válida?
            if (item.getQuantidade() == null || item.getQuantidade() <= 0) {
                throw new IllegalArgumentException("Quantidade deve ser maior que zero (Produto ID: " + item.getIdProduto() + ")");
            }

            // Estoque suficiente?
            Estoque estoque = estoqueRepository.findByIdProduto_Id(item.getIdProduto())
                    .orElseThrow(() -> new IllegalArgumentException("Estoque não encontrado para produto ID: " + item.getIdProduto()));

            if (estoque.getQuantidadeAtual() == null || estoque.getQuantidadeAtual() < item.getQuantidade()) {
                throw new IllegalArgumentException(
                        "Estoque insuficiente para produto '" + produto.getNome() + "'. " +
                        "Disponível: " + (estoque.getQuantidadeAtual() != null ? estoque.getQuantidadeAtual() : 0) + ", " +
                        "Solicitado: " + item.getQuantidade()
                );
            }

            // Somar ao total
            BigDecimal subtotal = produto.getPreco().multiply(BigDecimal.valueOf(item.getQuantidade()));
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
            Produto produto = produtoRepository.findById(itemRequest.getIdProduto()).orElseThrow();
            
            ItemPedido item = new ItemPedido();
            item.setIdPedido(pedido);
            item.setIdProduto(produto);
            item.setQuantidade(itemRequest.getQuantidade());
            item.setPrecoUnitario(produto.getPreco());
            
            itemPedidoRepository.save(item);
            pedido.getItens().add(item);
        }

        return toResponse(pedido);
    }

    // ====================== ATUALIZAR ======================

    @Caching(evict = {
            @CacheEvict(cacheNames = "pedidos", allEntries = true),
            @CacheEvict(cacheNames = "pedidoPorId", key = "#id"),
            @CacheEvict(cacheNames = "pedidosPorStatus", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPorCliente", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPrevisaoIa", key = "#id"),
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

        // Validar itens
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

            if (produto.getAtivo() != null && !produto.getAtivo()) {
                throw new IllegalArgumentException("Produto inativo (ID: " + item.getIdProduto() + ")");
            }

            if (item.getQuantidade() == null || item.getQuantidade() <= 0) {
                throw new IllegalArgumentException("Quantidade deve ser maior que zero (Produto ID: " + item.getIdProduto() + ")");
            }

            Estoque estoque = estoqueRepository.findByIdProduto_Id(item.getIdProduto())
                    .orElseThrow(() -> new IllegalArgumentException("Estoque não encontrado para produto ID: " + item.getIdProduto()));

            if (estoque.getQuantidadeAtual() == null || estoque.getQuantidadeAtual() < item.getQuantidade()) {
                throw new IllegalArgumentException(
                        "Estoque insuficiente para produto '" + produto.getNome() + "'. " +
                        "Disponível: " + (estoque.getQuantidadeAtual() != null ? estoque.getQuantidadeAtual() : 0) + ", " +
                        "Solicitado: " + item.getQuantidade()
                );
            }

            BigDecimal subtotal = produto.getPreco().multiply(BigDecimal.valueOf(item.getQuantidade()));
            valorTotal = valorTotal.add(subtotal);
        }

        // Atualizar dados gerais do pedido
        pedido.setIdCliente(cliente);
        pedido.setValorTotal(valorTotal);

        // Remover itens antigos
        itemPedidoRepository.deleteAll(pedido.getItens());
        pedido.getItens().clear();

        // Adicionar novos itens
        for (ItemPedidoRequest itemRequest : request.getItens()) {
            Produto produto = produtoRepository.findById(itemRequest.getIdProduto()).orElseThrow();
            
            ItemPedido item = new ItemPedido();
            item.setIdPedido(pedido);
            item.setIdProduto(produto);
            item.setQuantidade(itemRequest.getQuantidade());
            item.setPrecoUnitario(produto.getPreco());
            
            itemPedidoRepository.save(item);
            pedido.getItens().add(item);
        }

        pedido = pedidoRepository.save(pedido);
        return toResponse(pedido);
    }

    // ====================== MUDAR STATUS E CONTROLE DE ESTOQUE ======================

    @Caching(evict = {
            @CacheEvict(cacheNames = "pedidos", allEntries = true),
            @CacheEvict(cacheNames = "pedidoPorId", key = "#id"),
            @CacheEvict(cacheNames = "pedidosPorStatus", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPorCliente", allEntries = true),
            @CacheEvict(cacheNames = "produtosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "produtosTodos", allEntries = true),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public PedidoResponse mudarStatus(Integer id, String novoStatus) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado com ID: " + id));

        String statusAtual = pedido.getStatus();

        // Se já está no status solicitado, operação é idempotente
        if (novoStatus.equalsIgnoreCase(statusAtual)) {
            return toResponse(pedido);
        }

        // Validar novo status
        if (!TRANSICOES_VALIDAS.containsKey(novoStatus)) {
            throw new IllegalArgumentException("Status inválido: " + novoStatus);
        }

        // Validar transição
        Set<String> transicoesPermitidas = TRANSICOES_VALIDAS.get(statusAtual);
        if (transicoesPermitidas == null || !transicoesPermitidas.contains(novoStatus)) {
            throw new IllegalArgumentException(
                    "Transição inválida de '" + statusAtual + "' para '" + novoStatus + "'. " +
                    "Transições permitidas: " + (transicoesPermitidas != null ? transicoesPermitidas : "nenhuma")
            );
        }

        // ========== REGRA CRÍTICA DE ESTOQUE: BAIXA AO CONFIRMAR ==========
        if ("PENDENTE".equals(statusAtual) && "CONFIRMADO".equals(novoStatus)) {
            executarBaixaEstoque(pedido);
        }

        // ========== REGRA CRÍTICA DE ESTOQUE: ESTORNO AO CANCELAR ==========
        if ("CANCELADO".equals(novoStatus)) {
            // Apenas pedidos que já tiveram o estoque baixado devem estornar
            if ("CONFIRMADO".equals(statusAtual) || "EM_PREPARACAO".equals(statusAtual) || "PRONTO".equals(statusAtual)) {
                executarEstornoEstoque(pedido);
            }
        }

        // Atualizar status
        pedido.setStatus(novoStatus);
        pedido = pedidoRepository.save(pedido);

        return toResponse(pedido);
    }

    private void executarBaixaEstoque(Pedido pedido) {
        Usuario usuario = obterUsuarioAtual();

        for (ItemPedido item : pedido.getItens()) {
            Produto produto = item.getIdProduto();
            Estoque estoque = estoqueRepository.findByIdProduto_Id(produto.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Estoque não encontrado para produto ID: " + produto.getId()));

            int qtdAtual = estoque.getQuantidadeAtual() != null ? estoque.getQuantidadeAtual() : 0;
            if (qtdAtual < item.getQuantidade()) {
                throw new IllegalArgumentException(
                        "Estoque insuficiente para confirmar o pedido. Produto: " + produto.getNome() +
                        ". Disponível: " + qtdAtual + ", Solicitado: " + item.getQuantidade()
                );
            }

            estoque.setQuantidadeAtual(qtdAtual - item.getQuantidade());
            estoqueRepository.save(estoque);

            MovimentacaoEstoque mov = new MovimentacaoEstoque();
            mov.setIdProduto(produto);
            mov.setTipo("SAIDA");
            mov.setQuantidade(item.getQuantidade());
            mov.setDataMovimentacao(Instant.now());
            mov.setIdUsuario(usuario);
            movimentacaoEstoqueRepository.save(mov);
        }
    }

    private void executarEstornoEstoque(Pedido pedido) {
        Usuario usuario = obterUsuarioAtual();

        for (ItemPedido item : pedido.getItens()) {
            Produto produto = item.getIdProduto();
            Estoque estoque = estoqueRepository.findByIdProduto_Id(produto.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Estoque não encontrado para produto ID: " + produto.getId()));

            int qtdAtual = estoque.getQuantidadeAtual() != null ? estoque.getQuantidadeAtual() : 0;
            estoque.setQuantidadeAtual(qtdAtual + item.getQuantidade());
            estoqueRepository.save(estoque);

            MovimentacaoEstoque mov = new MovimentacaoEstoque();
            mov.setIdProduto(produto);
            mov.setTipo("ENTRADA");
            mov.setQuantidade(item.getQuantidade());
            mov.setDataMovimentacao(Instant.now());
            mov.setIdUsuario(usuario);
            movimentacaoEstoqueRepository.save(mov);
        }
    }

    // ====================== CANCELAR ======================

    @Caching(evict = {
            @CacheEvict(cacheNames = "pedidos", allEntries = true),
            @CacheEvict(cacheNames = "pedidoPorId", key = "#id"),
            @CacheEvict(cacheNames = "pedidosPorStatus", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPorCliente", allEntries = true),
            @CacheEvict(cacheNames = "produtosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "produtosTodos", allEntries = true),
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
            @CacheEvict(cacheNames = "pedidosPorCliente", allEntries = true),
            @CacheEvict(cacheNames = "produtosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "produtosTodos", allEntries = true),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public void deletarSoft(Integer id) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado com ID: " + id));

        // Soft delete = cancelar pedido se ainda não foi entregue ou já cancelado
        if (!"ENTREGUE".equals(pedido.getStatus()) && !"CANCELADO".equals(pedido.getStatus())) {
            mudarStatus(id, "CANCELADO");
        }
    }

    // ====================== CONVERSOR DTO ======================

    private PedidoResponse toResponse(Pedido pedido) {
        List<ItemPedidoResponse> itens = pedido.getItens() != null 
                ? pedido.getItens().stream()
                    .map(item -> new ItemPedidoResponse(
                            item.getId(),
                            item.getIdProduto().getId(),
                            item.getIdProduto().getNome(),
                            item.getQuantidade(),
                            item.getPrecoUnitario(),
                            item.getPrecoUnitario() != null && item.getQuantidade() != null
                                    ? item.getPrecoUnitario().multiply(BigDecimal.valueOf(item.getQuantidade()))
                                    : BigDecimal.ZERO
                    ))
                    .collect(Collectors.toList())
                : Collections.emptyList();

        return PedidoResponse.builder()
                .id(pedido.getId())
                .idCliente(pedido.getIdCliente().getId())
                .nomeCliente(pedido.getIdCliente().getNomeRazao())
                .dataPedido(pedido.getDataPedido())
                .status(pedido.getStatus())
                .valorTotal(pedido.getValorTotal() != null ? pedido.getValorTotal() : BigDecimal.ZERO)
                .idUsuario(pedido.getIdUsuario() != null ? pedido.getIdUsuario().getId() : null)
                .nomeUsuario(pedido.getIdUsuario() != null ? pedido.getIdUsuario().getNome() : null)
                .observacoes(null)
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
