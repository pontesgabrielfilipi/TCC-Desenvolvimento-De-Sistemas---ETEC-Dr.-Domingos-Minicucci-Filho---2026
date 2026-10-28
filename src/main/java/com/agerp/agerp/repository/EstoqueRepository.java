// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.repository;

import com.agerp.agerp.entity.Estoque;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public interface EstoqueRepository extends JpaRepository<Estoque, Integer> {

    Estoque findByIdProdutoId(Integer produtoId);

    /** Carrega os saldos da lista em lote, evitando uma consulta por produto. */
    @Query("SELECT e FROM Estoque e WHERE e.idProduto.id IN :produtoIds")
    List<Estoque> buscarPorProdutos(@Param("produtoIds") List<Integer> produtoIds);

    Optional<Estoque> findByIdProduto_Id(Integer produtoId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM Estoque e WHERE e.idProduto.id = :produtoId")
    Optional<Estoque> findByProdutoIdForUpdate(@Param("produtoId") Integer produtoId);

    /** Traz estoques e nomes dos produtos sem carregar relações lazy uma a uma. */
    @Query("SELECT e FROM Estoque e JOIN FETCH e.idProduto")
    List<Estoque> listarComProduto();

    @Query("SELECT COALESCE(SUM(e.quantidadeAtual), 0) FROM Estoque e")
    long somarQuantidadeAtual();

    @Modifying
    @Transactional
    @Query("DELETE FROM Estoque e WHERE e.idProduto.id = :produtoId")
    void deleteByIdProdutoId(@Param("produtoId") Integer produtoId);
}
