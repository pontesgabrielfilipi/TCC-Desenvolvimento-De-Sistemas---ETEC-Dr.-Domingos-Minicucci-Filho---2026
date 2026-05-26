package com.agerp.agerp.repository;

import com.agerp.agerp.entity.PrevisaoEntrega;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PrevisaoEntregaRepository extends JpaRepository<PrevisaoEntrega, Integer> {

    PrevisaoEntrega findByIdEntregaId(Integer entregaId);
}