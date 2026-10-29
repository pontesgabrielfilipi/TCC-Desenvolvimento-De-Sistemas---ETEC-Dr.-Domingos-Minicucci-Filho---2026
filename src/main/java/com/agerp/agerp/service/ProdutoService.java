// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.service;

import com.agerp.agerp.dto.ProdutoCreateRequest;
import com.agerp.agerp.dto.ProdutoResponse;
import com.agerp.agerp.dto.ProdutoUpdateRequest;
import com.agerp.agerp.entity.Estoque;
import com.agerp.agerp.entity.Produto;
import com.agerp.agerp.repository.EstoqueRepository;
import com.agerp.agerp.repository.ProdutoRepository;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ProdutoService {
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private AuditoriaNegocioService auditoria;

    private final ProdutoRepository produtoRepository;
    private final EstoqueRepository estoqueRepository;
    private final EstoqueBaixoService estoqueBaixoService;

    public ProdutoService(ProdutoRepository produtoRepository, EstoqueRepository estoqueRepository,
                          EstoqueBaixoService estoqueBaixoService) {
        this.produtoRepository = produtoRepository;
        this.estoqueRepository = estoqueRepository;
        this.estoqueBaixoService = estoqueBaixoService;
    }

    @Cacheable("produtosAtivos")
    @Transactional(readOnly = true)
    public List<ProdutoResponse> listarAtivos() {
        return listarComEstoques(produtoRepository.findByAtivoTrue());
    }

    @CacheEvict(cacheNames = "produtosAtivos", allEntries = true, beforeInvocation = true)
    @Transactional(readOnly = true)
    public List<ProdutoResponse> recarregarAtivos() {
        return listarComEstoques(produtoRepository.findByAtivoTrue());
    }

    @Cacheable("produtosTodos")
    @Transactional(readOnly = true)
    public List<ProdutoResponse> listarTodos() {
        return listarComEstoques(produtoRepository.findAll());
    }

    @Cacheable(value = "produtoPorId", key = "#id")
    @Transactional(readOnly = true)
    public ProdutoResponse buscarPorId(Integer id) {
        Produto produto = produtoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado com ID: " + id));
        return toResponse(produto);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "produtosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "produtosTodos", allEntries = true),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public ProdutoResponse criar(ProdutoCreateRequest request) {
        if (produtoRepository.existsByNomeIgnoreCase(request.getNome())) {
            throw new IllegalArgumentException("Já existe um produto com este nome.");
        }

        if (request.getPeso() == null)
            request.setPeso(BigDecimal.ZERO);
        if (request.getVolume() == null)
            request.setVolume(BigDecimal.ZERO);

        Produto produto = new Produto();
        produto.setNome(request.getNome());
        produto.setDescricao(request.getDescricao());
        produto.setPreco(request.getPreco());
        produto.setCusto(request.getCusto());
        produto.setPeso(request.getPeso());
        produto.setVolume(request.getVolume());
        produto.setAtivo(true);

        produto = produtoRepository.save(produto);

        Estoque estoque = new Estoque();
        estoque.setIdProduto(produto);
        estoque.setQuantidadeAtual(request.getQuantidadeInicial() != null ? request.getQuantidadeInicial() : 0);
        estoque.setQuantidadeMinima(request.getQuantidadeMinima() != null ? request.getQuantidadeMinima() : 10);
        estoque.setLocalizacao("Depósito Principal");
        estoqueRepository.save(estoque);
        if (auditoria != null) auditoria.registrar("CRIACAO_PRODUTO", "PRODUTO", produto.getId(),
                AuditoriaNegocioService.mudancas("preco", null, produto.getPreco(), "custo", null, produto.getCusto(),
                        "quantidadeAtual", null, estoque.getQuantidadeAtual(), "quantidadeMinima", null, estoque.getQuantidadeMinima()));

        return toResponse(produto);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "produtosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "produtosTodos", allEntries = true),
            @CacheEvict(cacheNames = "produtoPorId", key = "#id"),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public ProdutoResponse atualizar(Integer id, ProdutoUpdateRequest request) {
        BigDecimal precoAnterior;
        BigDecimal custoAnterior;
        Boolean ativoAnterior;
        Produto produto = produtoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado com ID: " + id));

        precoAnterior = produto.getPreco();
        custoAnterior = produto.getCusto();
        ativoAnterior = produto.getAtivo();
        if (request.getNome() != null &&
                produtoRepository.existsByNomeIgnoreCase(request.getNome()) &&
                !produto.getNome().equalsIgnoreCase(request.getNome())) {
            throw new IllegalArgumentException("Já existe outro produto com este nome.");
        }

        if (request.getNome() != null)
            produto.setNome(request.getNome());
        if (request.getDescricao() != null)
            produto.setDescricao(request.getDescricao());
        if (request.getPreco() != null)
            produto.setPreco(request.getPreco());
        if (request.getCusto() != null)
            produto.setCusto(request.getCusto());
        if (request.getPeso() != null)
            produto.setPeso(request.getPeso());
        if (request.getVolume() != null)
            produto.setVolume(request.getVolume());
        if (request.getAtivo() != null)
            produto.setAtivo(request.getAtivo());

        produto = produtoRepository.save(produto);

        Estoque estoque = estoqueRepository.findByIdProdutoId(produto.getId());
        Integer saldoAnterior = estoque == null ? null : estoque.getQuantidadeAtual();
        Integer minimoAnterior = estoque == null ? null : estoque.getQuantidadeMinima();
        if (estoque != null) {
            if (request.getQuantidadeAtual() != null) {
                estoque.setQuantidadeAtual(request.getQuantidadeAtual());
            }
            if (request.getQuantidadeMinima() != null) {
                estoque.setQuantidadeMinima(request.getQuantidadeMinima());
            }
            estoqueRepository.save(estoque);
        } else if (request.getQuantidadeAtual() != null || request.getQuantidadeMinima() != null) {
            estoque = new Estoque();
            estoque.setIdProduto(produto);
            estoque.setQuantidadeAtual(request.getQuantidadeAtual() != null ? request.getQuantidadeAtual() : 0);
            estoque.setQuantidadeMinima(request.getQuantidadeMinima() != null ? request.getQuantidadeMinima() : 10);
            estoque.setLocalizacao("Depósito Principal");
            estoqueRepository.save(estoque);
        }

        var alteracoes = AuditoriaNegocioService.mudancas("preco", precoAnterior, produto.getPreco(),
                "custo", custoAnterior, produto.getCusto(), "ativo", ativoAnterior, produto.getAtivo(),
                "quantidadeAtual", saldoAnterior, estoque == null ? null : estoque.getQuantidadeAtual(),
                "quantidadeMinima", minimoAnterior, estoque == null ? null : estoque.getQuantidadeMinima());
        if (auditoria != null && !alteracoes.isEmpty()) auditoria.registrar("EDICAO_PRODUTO", "PRODUTO", id, alteracoes);
        return toResponse(produto);
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "produtosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "produtosTodos", allEntries = true),
            @CacheEvict(cacheNames = "produtoPorId", key = "#id"),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public void deletarSoft(Integer id) {
        Produto produto = produtoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado com ID: " + id));

        if (Boolean.FALSE.equals(produto.getAtivo())) return;
        produto.setAtivo(false);
        produtoRepository.save(produto);
        if (auditoria != null) auditoria.registrar("EXCLUSAO_LOGICA_PRODUTO", "PRODUTO", id,
                AuditoriaNegocioService.mudancas("ativo", true, false));
    }

    @Caching(evict = {
            @CacheEvict(cacheNames = "produtosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "produtosTodos", allEntries = true),
            @CacheEvict(cacheNames = "produtoPorId", key = "#id"),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "adminEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public void deletarPermanente(Integer id) {
        Produto produto = produtoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado com ID: " + id));

        estoqueRepository.deleteByIdProdutoId(produto.getId());

        produtoRepository.deleteById(id);
        if (auditoria != null) auditoria.registrar("EXCLUSAO_PRODUTO", "PRODUTO", id, java.util.Map.of());
    }

    private List<ProdutoResponse> listarComEstoques(List<Produto> produtos) {
        var regra = estoqueBaixoService.regraAtual();
        if (produtos.isEmpty()) {
            return List.of();
        }
        var ids = produtos.stream().map(Produto::getId).toList();
        Map<Integer, Estoque> estoques = estoqueRepository.buscarPorProdutos(ids).stream()
                .collect(Collectors.toMap(e -> e.getIdProduto().getId(), e -> e));
        return produtos.stream().map(p -> toResponse(p, estoques.get(p.getId()), regra)).toList();
    }

    private ProdutoResponse toResponse(Produto produto) {
        return toResponse(produto, estoqueRepository.findByIdProdutoId(produto.getId()),
                estoqueBaixoService.regraAtual());
    }

    private ProdutoResponse toResponse(Produto produto, Estoque estoque, EstoqueBaixoService.Regra regra) {
        return new ProdutoResponse(
                produto.getId(),
                produto.getNome(),
                produto.getDescricao(),
                produto.getPreco(),
                produto.getCusto(),
                produto.getPeso(),
                produto.getVolume(),
                produto.getAtivo(),
                estoque != null ? estoque.getQuantidadeAtual() : null,
                estoque != null ? estoque.getQuantidadeMinima() : null,
                estoque != null ? estoque.getLocalizacao() : null,
                regra.minimoAplicado(estoque != null ? estoque.getQuantidadeMinima() : null),
                estoque != null && regra.baixo(estoque.getQuantidadeAtual(), estoque.getQuantidadeMinima()),
                regra.usarGeral());
    }
}
