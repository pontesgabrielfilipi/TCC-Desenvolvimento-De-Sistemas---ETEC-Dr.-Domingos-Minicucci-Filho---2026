// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.service;

import com.agerp.agerp.dto.*;
import com.agerp.agerp.entity.*;
import com.agerp.agerp.repository.*;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PedidoService {

    private final PedidoRepository pedidoRepository;
    private final ItemPedidoRepository itemPedidoRepository;
    private final ClienteRepository clienteRepository;
    private final ProdutoRepository produtoRepository;
    private final EstoqueRepository estoqueRepository;
    private final MovimentacaoEstoqueRepository movimentacaoEstoqueRepository;
    private final UsuarioRepository usuarioRepository;
    private final EnderecoRepository enderecoRepository;
    private final AuditoriaNegocioService auditoriaNegocioService;

    public PedidoService(PedidoRepository pedidoRepository,
                         ItemPedidoRepository itemPedidoRepository,
                         ClienteRepository clienteRepository,
                         ProdutoRepository produtoRepository,
                         EstoqueRepository estoqueRepository,
                         MovimentacaoEstoqueRepository movimentacaoEstoqueRepository,
                         UsuarioRepository usuarioRepository,
                         EnderecoRepository enderecoRepository,
                         AuditoriaNegocioService auditoriaNegocioService) {
        super();
        this.pedidoRepository = pedidoRepository;
        this.itemPedidoRepository = itemPedidoRepository;
        this.clienteRepository = clienteRepository;
        this.produtoRepository = produtoRepository;
        this.estoqueRepository = estoqueRepository;
        this.movimentacaoEstoqueRepository = movimentacaoEstoqueRepository;
        this.usuarioRepository = usuarioRepository;
        this.enderecoRepository = enderecoRepository;
        this.auditoriaNegocioService = auditoriaNegocioService;
    }

    private static final Map<String, Set<String>> TRANSICOES_VALIDAS = Map.ofEntries(
            Map.entry("PENDENTE", Set.of("CONFIRMADO", "CANCELADO")),
            Map.entry("CONFIRMADO", Set.of("EM_PREPARACAO", "CANCELADO")),
            Map.entry("EM_PREPARACAO", Set.of("PRONTO", "CANCELADO")),
            Map.entry("PRONTO", Set.of("ENTREGUE", "CANCELADO")),
            Map.entry("ENTREGUE", Set.of()),
            Map.entry("CANCELADO", Set.of())
    );

    @Cacheable(value = "pedidos", key = "#root.methodName")
    @Transactional(readOnly = true)
    public List<PedidoResponse> listarTodos() {
        return pedidoRepository.findAllByOrderByDataPedidoDesc().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @CacheEvict(cacheNames = "pedidos", allEntries = true, beforeInvocation = true)
    @Transactional(readOnly = true)
    public List<PedidoResponse> recarregarTodos() {
        return pedidoRepository.findAllByOrderByDataPedidoDesc().stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    @Cacheable(value = "pedidosPorStatus", key = "#status")
    @Transactional(readOnly = true)
    public List<PedidoResponse> listarPorStatus(String status) {
        String statusNormalizado = normalizarStatus(status);
        if (!TRANSICOES_VALIDAS.containsKey(statusNormalizado)) {
            throw new IllegalArgumentException("Status inválido: " + status);
        }
        return pedidoRepository.findByStatusOrderByDataPedidoDesc(statusNormalizado).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Cacheable(value = "pedidosPorCliente", key = "#idCliente")
    @Transactional(readOnly = true)
    public List<PedidoResponse> listarPorCliente(Integer idCliente) {
        clienteRepository.findById(idCliente)
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado com ID: " + idCliente));
        
        return pedidoRepository.findByIdCliente_IdOrderByDataPedidoDesc(idCliente).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<PedidoResponse> listarTodos(Pageable pageable) {
        return pedidoRepository.findAll(pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<PedidoResponse> listarPorStatus(String status, Pageable pageable) {
        String statusNormalizado = normalizarStatus(status);
        if (!TRANSICOES_VALIDAS.containsKey(statusNormalizado)) {
            throw new IllegalArgumentException("Status inválido: " + status);
        }
        return pedidoRepository.findByStatus(statusNormalizado, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<PedidoResponse> listarPorCliente(Integer idCliente, Pageable pageable) {
        if (!clienteRepository.existsById(idCliente)) {
            throw new IllegalArgumentException("Cliente não encontrado com ID: " + idCliente);
        }
        return pedidoRepository.findByIdCliente_Id(idCliente, pageable).map(this::toResponse);
    }


    @Cacheable(value = "pedidoPorId", key = "#id")
    @Transactional(readOnly = true)
    public PedidoResponse buscarPorId(Integer id) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado com ID: " + id));
        return toResponse(pedido);
    }


    @Caching(evict = {
            @CacheEvict(cacheNames = "pedidos", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPorStatus", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPorCliente", allEntries = true),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public PedidoResponse criar(PedidoCreateRequest request) {
        Cliente cliente = clienteRepository.findById(request.getIdCliente())
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado com ID: " + request.getIdCliente()));

        if (request.getItens() == null || request.getItens().isEmpty()) {
            throw new IllegalArgumentException("Pedido deve conter pelo menos um item");
        }

        Endereco enderecoEntrega = null;
        if (request.getIdEndereco() != null) {
            enderecoEntrega = enderecoRepository.findByIdAndIdClienteId(request.getIdEndereco(), request.getIdCliente())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Endereço ID " + request.getIdEndereco() + " não pertence ao cliente informado"));
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


        Pedido pedido = new Pedido();
        pedido.setIdCliente(cliente);
        pedido.setDataPedido(Instant.now());
        pedido.setStatus("PENDENTE");
        pedido.setValorTotal(valorTotal);
        pedido.setIdUsuario(obterUsuarioAtual());
        pedido.setObservacoes(request.getObservacoes());
        pedido.setIdEndereco(enderecoEntrega);

        pedido = pedidoRepository.save(pedido);


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

        auditoriaNegocioService.registrar("CRIACAO_PEDIDO", "PEDIDO", pedido.getId(),
                AuditoriaNegocioService.mudancas("status", null, pedido.getStatus(),
                        "valor", null, pedido.getValorTotal(), "clienteId", null, cliente.getId()));
        for (ItemPedido item : pedido.getItens()) {
            auditarItem(pedido, item.getIdProduto().getId(), null, item.getQuantidade());
        }
        return toResponse(pedido);
    }


    @Caching(evict = {
            @CacheEvict(cacheNames = "pedidos", allEntries = true),
            @CacheEvict(cacheNames = "pedidoPorId", key = "#id"),
            @CacheEvict(cacheNames = "pedidosPorStatus", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPorCliente", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPrevisaoIa", key = "#id"),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public PedidoResponse atualizar(Integer id, PedidoUpdateRequest request) {
        Pedido pedido = pedidoRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado com ID: " + id));

        if (!"PENDENTE".equals(pedido.getStatus())) {
            throw new IllegalArgumentException("Apenas pedidos PENDENTES podem ser editados. Status atual: " + pedido.getStatus());
        }

        Integer clienteAnterior = pedido.getIdCliente().getId();
        Integer enderecoAnterior = pedido.getIdEndereco() == null ? null : pedido.getIdEndereco().getId();
        BigDecimal valorAnterior = pedido.getValorTotal();
        Map<Integer, Integer> quantidadesAnteriores = pedido.getItens().stream()
                .collect(Collectors.toMap(item -> item.getIdProduto().getId(), ItemPedido::getQuantidade));

        Cliente cliente = clienteRepository.findById(request.getIdCliente())
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado com ID: " + request.getIdCliente()));

        if (request.getItens() == null || request.getItens().isEmpty()) {
            throw new IllegalArgumentException("Pedido deve conter pelo menos um item");
        }

        Endereco enderecoEntrega = null;
        if (request.getIdEndereco() != null) {
            enderecoEntrega = enderecoRepository.findByIdAndIdClienteId(request.getIdEndereco(), request.getIdCliente())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Endereço ID " + request.getIdEndereco() + " não pertence ao cliente informado"));
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

        pedido.setIdCliente(cliente);
        pedido.setValorTotal(valorTotal);
        pedido.setIdEndereco(enderecoEntrega);

        pedido.setObservacoes(request.getObservacoes());

        itemPedidoRepository.deleteAll(pedido.getItens());
        pedido.getItens().clear();

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
        auditoriaNegocioService.registrar("EDICAO_PEDIDO", "PEDIDO", pedido.getId(),
                AuditoriaNegocioService.mudancas("valor", valorAnterior, pedido.getValorTotal(),
                        "clienteId", clienteAnterior, cliente.getId(),
                        "enderecoId", enderecoAnterior, enderecoEntrega == null ? null : enderecoEntrega.getId()));
        Map<Integer, Integer> quantidadesNovas = pedido.getItens().stream()
                .collect(Collectors.toMap(item -> item.getIdProduto().getId(), ItemPedido::getQuantidade));
        Set<Integer> ids = new TreeSet<>(quantidadesAnteriores.keySet());
        ids.addAll(quantidadesNovas.keySet());
        for (Integer produtoId : ids) {
            if (!Objects.equals(quantidadesAnteriores.get(produtoId), quantidadesNovas.get(produtoId))) {
                auditarItem(pedido, produtoId, quantidadesAnteriores.get(produtoId), quantidadesNovas.get(produtoId));
            }
        }
        return toResponse(pedido);
    }


    @Caching(evict = {
            @CacheEvict(cacheNames = "pedidos", allEntries = true),
            @CacheEvict(cacheNames = "pedidoPorId", key = "#id"),
            @CacheEvict(cacheNames = "pedidosPorStatus", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPorCliente", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPrevisaoIa", key = "#id"),
            @CacheEvict(cacheNames = "produtosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "produtosTodos", allEntries = true),
            @CacheEvict(cacheNames = "produtoPorId", allEntries = true),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public PedidoResponse mudarStatus(Integer id, String novoStatus) {
        novoStatus = normalizarStatus(novoStatus);
        Pedido pedido = pedidoRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado com ID: " + id));

        String statusAtual = pedido.getStatus();

        // Repetir a mesma transição não pode movimentar o estoque novamente.
        if (novoStatus.equals(statusAtual)) {
            return toResponse(pedido);
        }

        if (!TRANSICOES_VALIDAS.containsKey(novoStatus)) {
            throw new IllegalArgumentException("Status inválido: " + novoStatus);
        }

        Set<String> transicoesPermitidas = TRANSICOES_VALIDAS.get(statusAtual);
        if (transicoesPermitidas == null || !transicoesPermitidas.contains(novoStatus)) {
            throw new IllegalArgumentException(
                    "Transição inválida de '" + statusAtual + "' para '" + novoStatus + "'. " +
                    "Transições permitidas: " + (transicoesPermitidas != null ? transicoesPermitidas : "nenhuma")
            );
        }

        // O estoque só é baixado na confirmação; pedidos pendentes ainda podem ser editados.
        if ("PENDENTE".equals(statusAtual) && "CONFIRMADO".equals(novoStatus)) {
            executarBaixaEstoque(pedido);
        }

        // Cancelamentos posteriores à confirmação devolvem exatamente os itens já baixados.
        if ("CANCELADO".equals(novoStatus)) {
            if ("CONFIRMADO".equals(statusAtual) || "EM_PREPARACAO".equals(statusAtual) || "PRONTO".equals(statusAtual)) {
                executarEstornoEstoque(pedido);
            }
        }

        pedido.setStatus(novoStatus);
        pedido = pedidoRepository.save(pedido);
        auditoriaNegocioService.registrar("ALTERACAO_STATUS_PEDIDO", "PEDIDO", pedido.getId(),
                AuditoriaNegocioService.mudancas("status", statusAtual, novoStatus));
        return toResponse(pedido);
    }

    private void executarBaixaEstoque(Pedido pedido) {
        Usuario usuario = obterUsuarioAtual();

        for (ItemPedido item : itensOrdenados(pedido)) {
            Produto produto = item.getIdProduto();
            Estoque estoque = estoqueRepository.findByProdutoIdForUpdate(produto.getId())
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
            auditarEstoque("BAIXA_ESTOQUE_PEDIDO", pedido, produto, qtdAtual, estoque.getQuantidadeAtual(), item.getQuantidade());
        }
    }

    private void executarEstornoEstoque(Pedido pedido) {
        Usuario usuario = obterUsuarioAtual();

        for (ItemPedido item : itensOrdenados(pedido)) {
            Produto produto = item.getIdProduto();
            Estoque estoque = estoqueRepository.findByProdutoIdForUpdate(produto.getId())
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
            auditarEstoque("ESTORNO_ESTOQUE_PEDIDO", pedido, produto, qtdAtual, estoque.getQuantidadeAtual(), item.getQuantidade());
        }
    }

    private List<ItemPedido> itensOrdenados(Pedido pedido) {
        return pedido.getItens().stream()
                .sorted(Comparator.comparing(item -> item.getIdProduto().getId()))
                .toList();
    }

    private void auditarItem(Pedido pedido, Integer produtoId, Integer anterior, Integer novo) {
        auditoriaNegocioService.registrar("ALTERACAO_ITEM_PEDIDO", "ITEM_PEDIDO", pedido.getId(),
                AuditoriaNegocioService.mudancas("produtoId", null, produtoId,
                        "quantidade", anterior, novo));
    }

    private void auditarEstoque(String acao, Pedido pedido, Produto produto, int antes, int depois, int quantidade) {
        auditoriaNegocioService.registrar(acao, "ESTOQUE", produto.getId(),
                AuditoriaNegocioService.mudancas("pedidoId", null, pedido.getId(),
                        "quantidadeAtual", antes, depois, "quantidade", null, quantidade));
    }


    @Caching(evict = {
            @CacheEvict(cacheNames = "pedidos", allEntries = true),
            @CacheEvict(cacheNames = "pedidoPorId", key = "#id"),
            @CacheEvict(cacheNames = "pedidosPorStatus", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPorCliente", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPrevisaoIa", key = "#id"),
            @CacheEvict(cacheNames = "produtosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "produtosTodos", allEntries = true),
            @CacheEvict(cacheNames = "produtoPorId", allEntries = true),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public PedidoResponse cancelar(Integer id) {
        return mudarStatus(id, "CANCELADO");
    }


    @Caching(evict = {
            @CacheEvict(cacheNames = "pedidos", allEntries = true),
            @CacheEvict(cacheNames = "pedidoPorId", key = "#id"),
            @CacheEvict(cacheNames = "pedidosPorStatus", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPorCliente", allEntries = true),
            @CacheEvict(cacheNames = "pedidosPrevisaoIa", key = "#id"),
            @CacheEvict(cacheNames = "produtosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "produtosTodos", allEntries = true),
            @CacheEvict(cacheNames = "produtoPorId", allEntries = true),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public void deletarSoft(Integer id) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado com ID: " + id));

        if ("ENTREGUE".equals(pedido.getStatus())) {
            throw new IllegalArgumentException("Pedido entregue não pode ser excluído ou cancelado.");
        }
        if (!"CANCELADO".equals(pedido.getStatus())) mudarStatus(id, "CANCELADO");
    }


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

        Endereco enderecoPedido = pedido.getIdEndereco();
        Integer idEndereco = null;
        String enderecoResumo = null;
        if (enderecoPedido != null) {
            idEndereco = enderecoPedido.getId();
            StringBuilder sb = new StringBuilder();
            if (enderecoPedido.getLogradouro() != null) sb.append(enderecoPedido.getLogradouro());
            if (enderecoPedido.getNumero() != null) sb.append(", ").append(enderecoPedido.getNumero());
            if (enderecoPedido.getBairro() != null) sb.append(" - ").append(enderecoPedido.getBairro());
            if (enderecoPedido.getCidade() != null) sb.append(", ").append(enderecoPedido.getCidade());
            if (enderecoPedido.getEstado() != null) sb.append("/").append(enderecoPedido.getEstado());
            enderecoResumo = sb.toString();
        }

        return PedidoResponse.builder()
                .id(pedido.getId())
                .idCliente(pedido.getIdCliente().getId())
                .nomeCliente(pedido.getIdCliente().getNomeRazao())
                .idEndereco(idEndereco)
                .enderecoResumo(enderecoResumo)
                .dataPedido(pedido.getDataPedido())
                .status(pedido.getStatus())
                .valorTotal(pedido.getValorTotal() != null ? pedido.getValorTotal() : BigDecimal.ZERO)
                .idUsuario(pedido.getIdUsuario() != null ? pedido.getIdUsuario().getId() : null)
                .nomeUsuario(pedido.getIdUsuario() != null ? pedido.getIdUsuario().getNome() : null)
                .observacoes(pedido.getObservacoes())
                .itens(itens)
                .build();
    }


    private String normalizarStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new IllegalArgumentException("Status deve ser informado");
        }
        return status.trim().toUpperCase(Locale.ROOT);
    }

    private Usuario obterUsuarioAtual() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        
        String email = authentication.getName();
        return usuarioRepository.findByEmail(email).orElse(null);
    }
}
