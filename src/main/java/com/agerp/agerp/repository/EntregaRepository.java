package com.agerp.agerp.repository;

import com.agerp.agerp.entity.Entrega;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EntregaRepository extends JpaRepository<Entrega, Integer> {

    Entrega findByIdPedidoId(Integer pedidoId);
}