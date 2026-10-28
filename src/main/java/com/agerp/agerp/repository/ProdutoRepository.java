package com.agerp.agerp.repository;

import com.agerp.agerp.entity.Produto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProdutoRepository extends JpaRepository<Produto, Integer> {

    List<Produto> findByAtivoTrue();

    List<Produto> findAll();

    boolean existsByNomeIgnoreCase(String nome);
}
