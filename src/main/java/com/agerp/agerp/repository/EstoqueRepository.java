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

@Repository
public interface EstoqueRepository extends JpaRepository<Estoque, Integer> {

    /** Busca estoque pelo ID do produto (usado no toResponse do ProdutoService) */
    Estoque findByIdProdutoId(Integer produtoId);

    /** Conta produtos com estoque baixo */
    long countByQuantidadeAtualLessThan(Integer quantidade);

    /** Lista os 10 produtos com estoque mais baixo (usado no Dashboard) */
    @Query(value = """
            SELECT 
                p.nome as nome,
                e.quantidade_atual as quantidade
            FROM agerp.estoque e
            JOIN agerp.produto p ON e.id_produto = p.id_produto
            WHERE e.quantidade_atual < :limite
            ORDER BY e.quantidade_atual ASC
            LIMIT 10
            """, nativeQuery = true)
    List<Map<String, Object>> produtosComEstoqueBaixo(@Param("limite") int limite);

    /** Hard Delete: Remove o estoque ao excluir permanentemente um produto */
    @Modifying
    @Transactional
    @Query("DELETE FROM Estoque e WHERE e.idProduto.id = :produtoId")
    void deleteByIdProdutoId(@Param("produtoId") Integer produtoId);
}