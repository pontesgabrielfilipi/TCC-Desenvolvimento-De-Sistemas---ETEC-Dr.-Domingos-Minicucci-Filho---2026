package com.agerp.agerp.service;

import com.agerp.agerp.dto.DashboardRelatorioCompletoDTO;
import com.agerp.agerp.repository.ClienteRepository;
import com.agerp.agerp.repository.EstoqueRepository;
import com.agerp.agerp.repository.PedidoRepository;
import com.agerp.agerp.repository.ProdutoRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
public class DashboardService {

    private final ClienteRepository clienteRepository;
    private final ProdutoRepository produtoRepository;
    private final PedidoRepository pedidoRepository;
    private final EstoqueRepository estoqueRepository;
    private final ConfiguracaoSistemaService configuracaoSistemaService;

    public DashboardService(ClienteRepository clienteRepository,
                            ProdutoRepository produtoRepository,
                            PedidoRepository pedidoRepository,
                            EstoqueRepository estoqueRepository,
                            ConfiguracaoSistemaService configuracaoSistemaService) {
        this.clienteRepository = clienteRepository;
        this.produtoRepository = produtoRepository;
        this.pedidoRepository = pedidoRepository;
        this.estoqueRepository = estoqueRepository;
        this.configuracaoSistemaService = configuracaoSistemaService;
    }

    @Cacheable("dashboardRelatorio")
    @Transactional(readOnly = true)
    public DashboardRelatorioCompletoDTO gerarRelatorioCompleto() {
        LocalDate hoje = LocalDate.now();

        return DashboardRelatorioCompletoDTO.builder()
                // Estatísticas básicas
                .totalClientes(clienteRepository.count())
                .totalProdutos(produtoRepository.count())
                .vendasMes(pedidoRepository.calcularTotalVendasDoMes(hoje.getMonthValue(), hoje.getYear()))
                .pedidosPendentes(pedidoRepository.countByStatusIn(List.of("PENDENTE", "EM_ANDAMENTO")))
                .produtosEstoqueBaixo(estoqueRepository.countByQuantidadeAtualLessThan(configuracaoSistemaService.limiteEstoqueBaixo()))

                // Gráficos
                .vendasMensais(pedidoRepository.vendasMensaisUltimos6Meses())
                .topProdutos(pedidoRepository.top5ProdutosMaisVendidos())
                .distribuicaoClientes(clienteRepository.distribuicaoTipoCliente())
                .statusPedidos(pedidoRepository.statusPedidosAtual())
                .estoqueBaixo(estoqueRepository.produtosComEstoqueBaixo(configuracaoSistemaService.limiteEstoqueBaixo()))

                .build();
    }

    // Método antigo (mantido para compatibilidade)
    @Cacheable("dashboardEstatisticas")
    @Transactional(readOnly = true)
    public Map<String, Object> getEstatisticasBasicas() {
        LocalDate hoje = LocalDate.now();
        return Map.of(
                "totalClientes", clienteRepository.count(),
                "totalProdutos", produtoRepository.count(),
                "vendasMes", pedidoRepository.calcularTotalVendasDoMes(hoje.getMonthValue(), hoje.getYear()),
                "pedidosPendentes", pedidoRepository.countByStatusIn(List.of("PENDENTE", "EM_ANDAMENTO")),
                "produtosEstoqueBaixo", estoqueRepository.countByQuantidadeAtualLessThan(configuracaoSistemaService.limiteEstoqueBaixo())
        );
    }
}
