package com.agerp.agerp.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record AdminEstatisticasResponse(
        Usuarios usuarios,
        Clientes clientes,
        Produtos produtos,
        Pedidos pedidos,
        FiltrosDisponiveis filtrosDisponiveis,
        Metadados metadados) {

    public record Usuarios(long total, long ativos, long pendentes, long bloqueados,
            List<Distribuicao> distribuicaoPerfis, Pagina<DesempenhoUsuario> desempenho,
            Pagina<MovimentacaoUsuario> movimentacoes) {}
    public record Clientes(long total, long comPedidos, Pagina<DesempenhoCliente> topFrequentes,
            List<EvolucaoCliente> evolucao) {}
    public record Produtos(long total, long quantidadeVendida, BigDecimal valorVendido,
            long estoqueDisponivel, long estoqueBaixo, Pagina<DesempenhoProduto> topVendidos) {}
    public record Pedidos(long total, long pendentes, long emAndamento, long concluidos, long cancelados,
            BigDecimal faturamento, BigDecimal ticketMedio,
            List<Distribuicao> distribuicaoStatus, List<PontoTemporal> evolucaoMensal) {}
    public record Distribuicao(String nome, long quantidade) {}
    public record DesempenhoUsuario(Integer id, String nome, long pedidos, BigDecimal faturamento) {}
    public record MovimentacaoUsuario(Integer id, String nome, long movimentacoes,
            long quantidadeSaida, long quantidadeEntrada) {}
    public record DesempenhoCliente(Integer id, String nome, long pedidos, BigDecimal faturamento) {}
    public record DesempenhoProduto(Integer id, String nome, long quantidade, BigDecimal valor) {}
    public record PontoTemporal(String periodo, long quantidade, BigDecimal valor) {}
    public record EvolucaoCliente(String periodo, Integer id, String nome, long pedidos, BigDecimal faturamento) {}
    public record Pagina<T>(List<T> conteudo, long totalElementos, int pagina, int tamanho, int totalPaginas) {}
    public record FiltrosDisponiveis(List<String> statusPedidos, List<String> categoriasProduto) {}
    public record Metadados(String regraFaturamento, String categoriaProduto,
            Map<String, List<String>> filtrosNaoAplicaveis) {}
}
