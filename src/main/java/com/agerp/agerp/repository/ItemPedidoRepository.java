package com.agerp.agerp.repository;

import com.agerp.agerp.entity.ItemPedido;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ItemPedidoRepository extends JpaRepository<ItemPedido, Integer> {

    List<ItemPedido> findByIdPedidoId(Integer pedidoId);
}