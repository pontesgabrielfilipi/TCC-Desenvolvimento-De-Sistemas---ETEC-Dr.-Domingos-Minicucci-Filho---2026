package com.agerp.agerp.repository;

import com.agerp.agerp.entity.Estoque;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public interface EstoqueRepository extends JpaRepository<Estoque, Integer> {

    /** Busca estoque pelo ID do produto (usado no toResponse do ProdutoService) */
    Estoque findByIdProdutoId(Integer produtoId);

    /** Carrega os saldos da lista em lote, evitando uma consulta por produto. */
    @Query("SELECT e FROM Estoque e WHERE e.idProduto.id IN :produtoIds")
    List<Estoque> buscarPorProdutos(@Param("produtoIds") List<Integer> produtoIds);

    /** Busca estoque pelo ID do produto (com Optional, para PedidoService) */
    Optional<Estoque> findByIdProduto_Id(Integer produtoId);

    /** Estoques e nomes dos produtos numa consulta, sem carregar relacoes lazy uma a uma. */
    @Query("SELECT e FROM Estoque e JOIN FETCH e.idProduto")
    List<Estoque> listarComProduto();

    @Query("SELECT COALESCE(SUM(e.quantidadeAtual), 0) FROM Estoque e")
    long somarQuantidadeAtual();

    /** Hard Delete: Remove o estoque ao excluir permanentemente um produto */
    @Modifying
    @Transactional
    @Query("DELETE FROM Estoque e WHERE e.idProduto.id = :produtoId")
    void deleteByIdProdutoId(@Param("produtoId") Integer produtoId);
}
