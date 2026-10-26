package com.agerp.agerp.repository;

import com.agerp.agerp.entity.Pedido;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public interface PedidoRepository extends JpaRepository<Pedido, Integer> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Pedido p WHERE p.id = :id")
    Optional<Pedido> findByIdForUpdate(@Param("id") Integer id);

    // ====================== ESTATÍSTICAS BÁSICAS ======================
    @Query("SELECT COALESCE(SUM(p.valorTotal), 0) FROM Pedido p " +
            "WHERE EXTRACT(MONTH FROM p.dataPedido) = :mes AND EXTRACT(YEAR FROM p.dataPedido) = :ano")
    BigDecimal calcularTotalVendasDoMes(@Param("mes") int mes, @Param("ano") int ano);

    long countByStatusIn(List<String> status);

    // ====================== GRÁFICOS DO DASHBOARD ======================

    /** Vendas mensais dos últimos 6 meses */
    @Query(value = """
        SELECT 
            TO_CHAR(p.data_pedido, 'MM/YYYY') as mes,
            COALESCE(SUM(p.valor_total), 0) as valor
        FROM agerp.pedido p
        WHERE p.data_pedido >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY TO_CHAR(p.data_pedido, 'MM/YYYY'), 
                 EXTRACT(YEAR FROM p.data_pedido), 
                 EXTRACT(MONTH FROM p.data_pedido)
        ORDER BY EXTRACT(YEAR FROM p.data_pedido) DESC, 
                 EXTRACT(MONTH FROM p.data_pedido) DESC
        """, nativeQuery = true)
    List<Map<String, Object>> vendasMensaisUltimos6Meses();

    /** Top 5 produtos mais vendidos */
    @Query(value = """
        SELECT 
            pr.nome as nome,
            SUM(pi.quantidade) as vendas
        FROM agerp.pedido p
        JOIN agerp.item_pedido pi ON pi.id_pedido = p.id_pedido
        JOIN agerp.produto pr ON pi.id_produto = pr.id_produto
        WHERE p.data_pedido >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY pr.id_produto, pr.nome
        ORDER BY SUM(pi.quantidade) DESC
        LIMIT 5
        """, nativeQuery = true)
    List<Map<String, Object>> top5ProdutosMaisVendidos();

    /** Status atual dos pedidos */
    @Query(value = """
        SELECT 
            p.status as name,
            COUNT(*) as value
        FROM agerp.pedido p
        GROUP BY p.status
        """, nativeQuery = true)
    List<Map<String, Object>> statusPedidosAtual();

    // ====================== MÉTODOS AUXILIARES ======================
    @Query("SELECT COUNT(p) FROM Pedido p WHERE p.status IN ('PENDENTE', 'EM_ANDAMENTO')")
    long countPedidosPendentes();

    List<Pedido> findTop10ByOrderByDataPedidoDesc();

    // ====================== PEDIDO SERVICE ======================
    List<Pedido> findByStatus(String status);

    List<Pedido> findByIdCliente_Id(Integer idCliente);

    List<Pedido> findAllByOrderByDataPedidoDesc();

    List<Pedido> findByStatusOrderByDataPedidoDesc(String status);

    List<Pedido> findByIdCliente_IdOrderByDataPedidoDesc(Integer idCliente);

    boolean existsByIdCliente_Id(Integer idCliente);

    Page<Pedido> findByStatus(String status, Pageable pageable);

    Page<Pedido> findByIdCliente_Id(Integer idCliente, Pageable pageable);
}
