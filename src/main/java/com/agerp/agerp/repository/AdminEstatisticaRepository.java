// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public class AdminEstatisticaRepository {
    private final EntityManager entityManager;

    public AdminEstatisticaRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public List<Object[]> consultar(String select, String joins, Filtros filtros, String groupOrder) {
        return consultar(select, joins, filtros, groupOrder, null, null);
    }

    public List<Object[]> consultar(String select, String joins, Filtros filtros, String groupOrder,
            Integer pagina, Integer tamanho) {
        StringBuilder sql = new StringBuilder(select).append(" FROM agerp.pedido p ")
                .append(joins == null ? "" : joins).append(" WHERE 1=1 ");
        aplicarFiltrosPedido(sql, filtros, "p");
        sql.append(groupOrder == null ? "" : groupOrder);
        Query query = entityManager.createNativeQuery(sql.toString());
        aplicarParametrosPedido(query, filtros);
        if (pagina != null && tamanho != null) {
            query.setFirstResult(Math.max(0, pagina) * Math.max(1, tamanho));
            query.setMaxResults(Math.max(1, tamanho));
        }
        @SuppressWarnings("unchecked") List<Object[]> rows = query.getResultList();
        return rows;
    }

    public long contarDistintos(String expressao, String joins, Filtros filtros) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(DISTINCT ").append(expressao).append(") FROM agerp.pedido p ")
                .append(joins == null ? "" : joins).append(" WHERE 1=1 ");
        aplicarFiltrosPedido(sql, filtros, "p");
        Query query = entityManager.createNativeQuery(sql.toString());
        aplicarParametrosPedido(query, filtros);
        Number total = (Number) query.getSingleResult();
        return total == null ? 0 : total.longValue();
    }

    public List<Object[]> consultarMovimentacoesPorUsuario(Filtros filtros, int pagina, int tamanho) {
        StringBuilder sql = new StringBuilder("""
                SELECT u.id_usuario, u.nome, COUNT(*),
                       COALESCE(SUM(CASE WHEN UPPER(COALESCE(m.tipo,'')) = 'SAIDA' THEN m.quantidade ELSE 0 END),0),
                       COALESCE(SUM(CASE WHEN UPPER(COALESCE(m.tipo,'')) = 'ENTRADA' THEN m.quantidade ELSE 0 END),0)
                  FROM agerp.movimentacao_estoque m
                  JOIN agerp.usuario u ON u.id_usuario = m.id_usuario
                 WHERE m.id_usuario IS NOT NULL
                """);
        aplicarFiltrosMovimentacao(sql, filtros);
        sql.append(" GROUP BY u.id_usuario, u.nome ORDER BY COUNT(*) DESC, u.nome ASC");
        Query query = entityManager.createNativeQuery(sql.toString());
        aplicarParametrosMovimentacao(query, filtros);
        query.setFirstResult(Math.max(0, pagina) * Math.max(1, tamanho));
        query.setMaxResults(Math.max(1, tamanho));
        @SuppressWarnings("unchecked") List<Object[]> rows = query.getResultList();
        return rows;
    }

    public long contarUsuariosComMovimentacao(Filtros filtros) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(DISTINCT m.id_usuario) FROM agerp.movimentacao_estoque m WHERE m.id_usuario IS NOT NULL");
        aplicarFiltrosMovimentacao(sql, filtros);
        Query query = entityManager.createNativeQuery(sql.toString());
        aplicarParametrosMovimentacao(query, filtros);
        Number total = (Number) query.getSingleResult();
        return total == null ? 0 : total.longValue();
    }

    public List<String> statusExistentes() {
        return entityManager.createQuery("select distinct p.status from Pedido p where p.status is not null order by p.status", String.class)
                .getResultList();
    }

    private static void aplicarFiltrosPedido(StringBuilder sql, Filtros filtros, String alias) {
        if (filtros.inicio() != null) sql.append(" AND ").append(alias).append(".data_pedido >= :inicio");
        if (filtros.fim() != null) sql.append(" AND ").append(alias).append(".data_pedido <= :fim");
        if (!filtros.usuarioIds().isEmpty()) sql.append(" AND ").append(alias).append(".id_usuario IN (:usuarioIds)");
        if (!filtros.clienteIds().isEmpty()) sql.append(" AND ").append(alias).append(".id_cliente IN (:clienteIds)");
        if (!filtros.statusPedidos().isEmpty()) sql.append(" AND UPPER(").append(alias).append(".status) IN (:statusPedidos)");
    }

    private static void aplicarParametrosPedido(Query query, Filtros filtros) {
        if (filtros.inicio() != null) query.setParameter("inicio", filtros.inicio());
        if (filtros.fim() != null) query.setParameter("fim", filtros.fim());
        if (!filtros.usuarioIds().isEmpty()) query.setParameter("usuarioIds", filtros.usuarioIds());
        if (!filtros.clienteIds().isEmpty()) query.setParameter("clienteIds", filtros.clienteIds());
        if (!filtros.statusPedidos().isEmpty()) query.setParameter("statusPedidos", filtros.statusPedidos());
    }

    private static void aplicarFiltrosMovimentacao(StringBuilder sql, Filtros filtros) {
        if (filtros.inicio() != null) sql.append(" AND m.data_movimentacao >= :inicio");
        if (filtros.fim() != null) sql.append(" AND m.data_movimentacao <= :fim");
        if (!filtros.usuarioIds().isEmpty()) sql.append(" AND m.id_usuario IN (:usuarioIds)");
    }

    private static void aplicarParametrosMovimentacao(Query query, Filtros filtros) {
        if (filtros.inicio() != null) query.setParameter("inicio", filtros.inicio());
        if (filtros.fim() != null) query.setParameter("fim", filtros.fim());
        if (!filtros.usuarioIds().isEmpty()) query.setParameter("usuarioIds", filtros.usuarioIds());
    }

    public record Filtros(List<Integer> usuarioIds, List<Integer> clienteIds,
            List<String> statusPedidos, LocalDateTime inicio, LocalDateTime fim) {}
}
