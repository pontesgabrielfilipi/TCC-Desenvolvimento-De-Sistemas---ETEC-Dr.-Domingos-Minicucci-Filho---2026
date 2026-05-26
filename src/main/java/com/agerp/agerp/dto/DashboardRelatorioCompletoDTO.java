package com.agerp.agerp.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class DashboardRelatorioCompletoDTO {

    private long totalClientes;
    private long totalProdutos;
    private BigDecimal vendasMes;
    private long pedidosPendentes;
    private long produtosEstoqueBaixo;

    // Gráficos
    private List<Map<String, Object>> vendasMensais;      // {mes, valor}
    private List<Map<String, Object>> topProdutos;        // {nome, vendas}
    private List<Map<String, Object>> distribuicaoClientes; // {name: "Física", value: 68}
    private List<Map<String, Object>> statusPedidos;      // {name: "Pendente", value: 12}
    private List<Map<String, Object>> estoqueBaixo;       // {nome, quantidade}
}