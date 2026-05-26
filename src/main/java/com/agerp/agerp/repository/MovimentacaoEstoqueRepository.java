package com.agerp.agerp.repository;

import com.agerp.agerp.entity.MovimentacaoEstoque;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MovimentacaoEstoqueRepository extends JpaRepository<MovimentacaoEstoque, Integer> {

    List<MovimentacaoEstoque> findByIdProdutoIdOrderByDataMovimentacaoDesc(Integer produtoId);
}