package com.agerp.agerp.repository;

import com.agerp.agerp.entity.Pagamento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PagamentoRepository extends JpaRepository<Pagamento, Integer> {

    List<Pagamento> findByIdPedidoId(Integer pedidoId);
}