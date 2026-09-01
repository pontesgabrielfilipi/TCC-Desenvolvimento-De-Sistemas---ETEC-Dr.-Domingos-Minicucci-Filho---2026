package com.agerp.agerp.service;

import com.agerp.agerp.dto.ProdutoCreateRequest;
import com.agerp.agerp.dto.ProdutoResponse;
import com.agerp.agerp.dto.ProdutoUpdateRequest;
import com.agerp.agerp.entity.Estoque;
import com.agerp.agerp.entity.Produto;
import com.agerp.agerp.repository.EstoqueRepository;
import com.agerp.agerp.repository.ProdutoRepository;
import lombok.RequiredArgsConstructor;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProdutoService {

    private final ProdutoRepository produtoRepository;
    private final EstoqueRepository estoqueRepository;

    // ====================== LISTAR ATIVOS ======================
    @Cacheable("produtosAtivos")
    @Transactional(readOnly = true)
    public List<ProdutoResponse> listarAtivos() {
        return produtoRepository.findByAtivoTrue()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ====================== LISTAR TODOS (ativos + inativos)
    // ======================
    @Cacheable("produtosTodos")
    @Transactional(readOnly = true)
    public List<ProdutoResponse> listarTodos() {
        return produtoRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ====================== BUSCAR POR ID ======================
    @Cacheable(value = "produtoPorId", key = "#id")
    @Transactional(readOnly = true)
    public ProdutoResponse buscarPorId(Integer id) {
        Produto produto = produtoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado com ID: " + id));
        return toResponse(produto);
    }

    // ====================== CRIAR ======================
    @Caching(evict = {
            @CacheEvict(cacheNames = "produtosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "produtosTodos", allEntries = true),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public ProdutoResponse criar(ProdutoCreateRequest request) {
        if (produtoRepository.existsByNomeIgnoreCase(request.getNome())) {
            throw new IllegalArgumentException("Já existe um produto com este nome.");
        }

        // Defesas contra null
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

        // Cria estoque automaticamente
        Estoque estoque = new Estoque();
        estoque.setIdProduto(produto);
        estoque.setQuantidadeAtual(request.getQuantidadeInicial() != null ? request.getQuantidadeInicial() : 0);
        estoque.setQuantidadeMinima(request.getQuantidadeMinima() != null ? request.getQuantidadeMinima() : 10);
        estoque.setLocalizacao("Depósito Principal");
        estoqueRepository.save(estoque);

        return toResponse(produto);
    }

    // ====================== ATUALIZAR ======================
    @Caching(evict = {
            @CacheEvict(cacheNames = "produtosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "produtosTodos", allEntries = true),
            @CacheEvict(cacheNames = "produtoPorId", key = "#id"),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public ProdutoResponse atualizar(Integer id, ProdutoUpdateRequest request) {
        Produto produto = produtoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado com ID: " + id));

        // Validação de nome duplicado ao editar
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
        return toResponse(produto);
    }

    // ====================== SOFT DELETE ======================
    @Caching(evict = {
            @CacheEvict(cacheNames = "produtosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "produtosTodos", allEntries = true),
            @CacheEvict(cacheNames = "produtoPorId", key = "#id"),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public void deletarSoft(Integer id) {
        Produto produto = produtoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado com ID: " + id));

        produto.setAtivo(false);
        produtoRepository.save(produto);
    }

    // ====================== HARD DELETE ======================
    @Caching(evict = {
            @CacheEvict(cacheNames = "produtosAtivos", allEntries = true),
            @CacheEvict(cacheNames = "produtosTodos", allEntries = true),
            @CacheEvict(cacheNames = "produtoPorId", key = "#id"),
            @CacheEvict(cacheNames = "dashboardEstatisticas", allEntries = true),
            @CacheEvict(cacheNames = "dashboardRelatorio", allEntries = true)
    })
    @Transactional
    public void deletarPermanente(Integer id) {
        Produto produto = produtoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Produto não encontrado com ID: " + id));

        // Remove estoque associado antes (evita erro de constraint)
        estoqueRepository.deleteByIdProdutoId(produto.getId());

        produtoRepository.deleteById(id);
    }

    // ====================== MAPPER ======================
    private ProdutoResponse toResponse(Produto produto) {
        Estoque estoque = estoqueRepository.findByIdProdutoId(produto.getId());

        return new ProdutoResponse(
                produto.getId(),
                produto.getNome(),
                produto.getDescricao(),
                produto.getPreco(),
                produto.getCusto(),
                produto.getPeso(),
                produto.getVolume(),
                produto.getAtivo(),
                estoque != null ? estoque.getQuantidadeAtual() : 0,
                estoque != null ? estoque.getQuantidadeMinima() : 10,
                estoque != null ? estoque.getLocalizacao() : null);
    }
}
