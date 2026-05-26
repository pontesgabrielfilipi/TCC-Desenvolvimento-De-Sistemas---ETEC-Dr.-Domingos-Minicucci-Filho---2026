package com.agerp.agerp.repository;

import com.agerp.agerp.entity.Produto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProdutoRepository extends JpaRepository<Produto, Integer> {

    /** Lista apenas produtos ATIVOS */
    List<Produto> findByAtivoTrue();

    /** Lista TODOS os produtos (ativos + inativos) */
    List<Produto> findAll();

    /** Verifica nome duplicado (ignore case) */
    boolean existsByNomeIgnoreCase(String nome);
}