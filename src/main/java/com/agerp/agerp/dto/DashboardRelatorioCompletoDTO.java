// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

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

    private List<Map<String, Object>> vendasMensais;
    private List<Map<String, Object>> topProdutos;
    private List<Map<String, Object>> distribuicaoClientes;
    private List<Map<String, Object>> statusPedidos;
    private List<Map<String, Object>> estoqueBaixo;
}
