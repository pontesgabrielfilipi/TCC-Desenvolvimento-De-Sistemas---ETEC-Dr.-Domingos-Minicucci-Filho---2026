// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

package com.agerp.agerp.service;

import com.agerp.agerp.dto.AdminEstatisticasResponse;
import com.agerp.agerp.entity.StatusAcesso;
import com.agerp.agerp.repository.AdminEstatisticaRepository;
import com.agerp.agerp.repository.ClienteRepository;
import com.agerp.agerp.repository.EstoqueRepository;
import com.agerp.agerp.repository.ProdutoRepository;
import com.agerp.agerp.repository.UsuarioRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class AdminService {
    private static final List<String> FILTROS_PEDIDO = List.of(
            "usuarioIds", "clienteIds", "statusPedidos", "inicio", "fim");
    private static final List<String> FILTROS_NAO_APLICAVEIS_MOVIMENTACAO = List.of(
            "clienteIds", "statusPedidos");

    private final UsuarioRepository usuarioRepository;
    private final ClienteRepository clienteRepository;
    private final ProdutoRepository produtoRepository;
    private final EstoqueRepository estoqueRepository;
    private final EstoqueBaixoService estoqueBaixoService;
    private final AdminEstatisticaRepository estatisticaRepository;

    public AdminService(UsuarioRepository usuarioRepository, ClienteRepository clienteRepository,
            ProdutoRepository produtoRepository, EstoqueRepository estoqueRepository,
            EstoqueBaixoService estoqueBaixoService,
            AdminEstatisticaRepository estatisticaRepository) {
        this.usuarioRepository = usuarioRepository;
        this.clienteRepository = clienteRepository;
        this.produtoRepository = produtoRepository;
        this.estoqueRepository = estoqueRepository;
        this.estoqueBaixoService = estoqueBaixoService;
        this.estatisticaRepository = estatisticaRepository;
    }

    @Cacheable(cacheNames = "adminEstatisticas")
    @Transactional(readOnly = true)
    public AdminEstatisticasResponse estatisticas(
            List<Integer> usuarioIds,
            List<Integer> clienteIds,
            List<String> statusPedidos,
            LocalDateTime inicio,
            LocalDateTime fim,
            int paginaProdutos,
            int paginaUsuarios,
            int paginaClientes,
            int paginaMovimentacoes,
            int tamanhoPagina) {
        if (inicio != null && fim != null && inicio.isAfter(fim)) {
            throw new IllegalArgumentException("Data inicial deve ser anterior à data final.");
        }

        int tamanho = Math.min(Math.max(tamanhoPagina, 1), 100);
        int pagProdutos = Math.max(paginaProdutos, 0);
        int pagUsuarios = Math.max(paginaUsuarios, 0);
        int pagClientes = Math.max(paginaClientes, 0);
        int pagMovimentacoes = Math.max(paginaMovimentacoes, 0);

        var filtros = new AdminEstatisticaRepository.Filtros(
                lista(usuarioIds), lista(clienteIds), statusNormalizados(statusPedidos), inicio, fim);

        Object[] resumo = primeira(estatisticaRepository.consultar(
                "SELECT COUNT(*), "
                        + "COALESCE(SUM(CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN p.valor_total ELSE 0 END),0), "
                        + "COALESCE(AVG(CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN p.valor_total END),0), "
                        + "COUNT(DISTINCT p.id_cliente)",
                "", filtros, null));

        List<AdminEstatisticasResponse.Distribuicao> distribuicaoStatus = estatisticaRepository.consultar(
                        "SELECT UPPER(COALESCE(p.status, 'SEM_STATUS')), COUNT(*)",
                        "", filtros,
                        " GROUP BY UPPER(COALESCE(p.status, 'SEM_STATUS')) ORDER BY COUNT(*) DESC")
                .stream()
                .map(r -> new AdminEstatisticasResponse.Distribuicao(str(r[0]), inteiro(r[1])))
                .toList();

        long pendentes = quantidadeStatus(distribuicaoStatus, "PENDENTE");
        long emAndamento = quantidadeStatus(distribuicaoStatus, "CONFIRMADO")
                + quantidadeStatus(distribuicaoStatus, "EM_PREPARACAO")
                + quantidadeStatus(distribuicaoStatus, "PRONTO");
        long concluidos = quantidadeStatus(distribuicaoStatus, "ENTREGUE");
        long cancelados = quantidadeStatus(distribuicaoStatus, "CANCELADO");

        List<AdminEstatisticasResponse.PontoTemporal> evolucaoMensal = estatisticaRepository.consultar(
                        "SELECT TO_CHAR(DATE_TRUNC('month', p.data_pedido), 'YYYY-MM'), COUNT(*), "
                                + "COALESCE(SUM(CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN p.valor_total ELSE 0 END),0)",
                        "", filtros,
                        " GROUP BY DATE_TRUNC('month', p.data_pedido) ORDER BY DATE_TRUNC('month', p.data_pedido)")
                .stream()
                .map(r -> new AdminEstatisticasResponse.PontoTemporal(str(r[0]), inteiro(r[1]), decimal(r[2])))
                .toList();

        long totalUsuariosDesempenho = estatisticaRepository.contarDistintos(
                "p.id_usuario", " JOIN agerp.usuario u ON u.id_usuario = p.id_usuario", filtros);
        List<AdminEstatisticasResponse.DesempenhoUsuario> usuariosDesempenho = estatisticaRepository.consultar(
                        "SELECT u.id_usuario, u.nome, COUNT(*), "
                                + "COALESCE(SUM(CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN p.valor_total ELSE 0 END),0)",
                        " JOIN agerp.usuario u ON u.id_usuario = p.id_usuario", filtros,
                        " GROUP BY u.id_usuario,u.nome ORDER BY 4 DESC, u.nome ASC",
                        pagUsuarios, tamanho)
                .stream()
                .map(r -> new AdminEstatisticasResponse.DesempenhoUsuario(
                        numero(r[0]), str(r[1]), inteiro(r[2]), decimal(r[3])))
                .toList();

        long totalClientesDesempenho = estatisticaRepository.contarDistintos(
                "p.id_cliente", " JOIN agerp.cliente c ON c.id_cliente = p.id_cliente", filtros);
        List<AdminEstatisticasResponse.DesempenhoCliente> clientesDesempenho = estatisticaRepository.consultar(
                        "SELECT c.id_cliente,c.nome_razao,COUNT(*),"
                                + "COALESCE(SUM(CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN p.valor_total ELSE 0 END),0)",
                        " JOIN agerp.cliente c ON c.id_cliente=p.id_cliente", filtros,
                        " GROUP BY c.id_cliente,c.nome_razao ORDER BY COUNT(*) DESC, c.nome_razao ASC",
                        pagClientes, tamanho)
                .stream()
                .map(r -> new AdminEstatisticasResponse.DesempenhoCliente(
                        numero(r[0]), str(r[1]), inteiro(r[2]), decimal(r[3])))
                .toList();

        List<AdminEstatisticasResponse.EvolucaoCliente> evolucaoClientes = estatisticaRepository.consultar(
                        "SELECT TO_CHAR(DATE_TRUNC('month', p.data_pedido), 'YYYY-MM'), "
                                + "c.id_cliente, c.nome_razao, COUNT(*), "
                                + "COALESCE(SUM(CASE WHEN UPPER(COALESCE(p.status,'')) <> 'CANCELADO' THEN p.valor_total ELSE 0 END),0)",
                        " JOIN agerp.cliente c ON c.id_cliente=p.id_cliente", filtros,
                        " GROUP BY DATE_TRUNC('month', p.data_pedido), c.id_cliente, c.nome_razao "
                                + "ORDER BY DATE_TRUNC('month', p.data_pedido), c.nome_razao")
                .stream()
                .map(r -> new AdminEstatisticasResponse.EvolucaoCliente(
                        str(r[0]), numero(r[1]), str(r[2]), inteiro(r[3]), decimal(r[4])))
                .toList();

        String condicaoItens = filtros.statusPedidos().contains("CANCELADO")
                ? "1=1"
                : "UPPER(COALESCE(p.status,'')) <> 'CANCELADO'";
        String joinsProdutos = " JOIN agerp.item_pedido i ON i.id_pedido=p.id_pedido "
                + "JOIN agerp.produto pr ON pr.id_produto=i.id_produto";
        long totalProdutosDesempenho = estatisticaRepository.contarDistintos("pr.id_produto", joinsProdutos, filtros);
        List<AdminEstatisticasResponse.DesempenhoProduto> produtosDesempenho = estatisticaRepository.consultar(
                        "SELECT pr.id_produto,pr.nome,"
                                + "COALESCE(SUM(CASE WHEN " + condicaoItens + " THEN i.quantidade ELSE 0 END),0),"
                                + "COALESCE(SUM(CASE WHEN " + condicaoItens + " THEN i.quantidade*i.preco_unitario ELSE 0 END),0)",
                        joinsProdutos, filtros,
                        " GROUP BY pr.id_produto,pr.nome ORDER BY 3 DESC, pr.nome ASC",
                        pagProdutos, tamanho)
                .stream()
                .map(r -> new AdminEstatisticasResponse.DesempenhoProduto(
                        numero(r[0]), str(r[1]), inteiro(r[2]), decimal(r[3])))
                .toList();

        Object[] itemResumo = primeira(estatisticaRepository.consultar(
                "SELECT COALESCE(SUM(CASE WHEN " + condicaoItens + " THEN i.quantidade ELSE 0 END),0),"
                        + "COALESCE(SUM(CASE WHEN " + condicaoItens + " THEN i.quantidade*i.preco_unitario ELSE 0 END),0)",
                " JOIN agerp.item_pedido i ON i.id_pedido=p.id_pedido", filtros, null));

        List<AdminEstatisticasResponse.Distribuicao> perfis = usuarioRepository.contarPorPerfil().stream()
                .map(r -> new AdminEstatisticasResponse.Distribuicao(str(r[0]), inteiro(r[1])))
                .toList();

        long totalUsuariosMovimentacao = estatisticaRepository.contarUsuariosComMovimentacao(filtros);
        List<AdminEstatisticasResponse.MovimentacaoUsuario> movimentacoes = estatisticaRepository
                .consultarMovimentacoesPorUsuario(filtros, pagMovimentacoes, tamanho)
                .stream()
                .map(r -> new AdminEstatisticasResponse.MovimentacaoUsuario(
                        numero(r[0]), str(r[1]), inteiro(r[2]), inteiro(r[3]), inteiro(r[4])))
                .toList();

        return new AdminEstatisticasResponse(
                new AdminEstatisticasResponse.Usuarios(
                        usuarioRepository.count(),
                        usuarioRepository.countByAtivoTrue(),
                        usuarioRepository.countByStatusAcesso(StatusAcesso.PENDENTE),
                        usuarioRepository.countByStatusAcesso(StatusAcesso.BLOQUEADO),
                        perfis,
                        pagina(usuariosDesempenho, totalUsuariosDesempenho, pagUsuarios, tamanho),
                        pagina(movimentacoes, totalUsuariosMovimentacao, pagMovimentacoes, tamanho)),
                new AdminEstatisticasResponse.Clientes(
                        clienteRepository.count(),
                        inteiro(resumo[3]),
                        pagina(clientesDesempenho, totalClientesDesempenho, pagClientes, tamanho),
                        evolucaoClientes),
                new AdminEstatisticasResponse.Produtos(
                        produtoRepository.count(),
                        inteiro(itemResumo[0]),
                        decimal(itemResumo[1]),
                        estoqueRepository.somarQuantidadeAtual(),
                        estoqueBaixoService.listar().size(),
                        pagina(produtosDesempenho, totalProdutosDesempenho, pagProdutos, tamanho)),
                new AdminEstatisticasResponse.Pedidos(
                        inteiro(resumo[0]),
                        pendentes,
                        emAndamento,
                        concluidos,
                        cancelados,
                        decimal(resumo[1]),
                        decimal(resumo[2]),
                        distribuicaoStatus,
                        evolucaoMensal),
                new AdminEstatisticasResponse.FiltrosDisponiveis(
                        estatisticaRepository.statusExistentes().stream()
                                .filter(Objects::nonNull)
                                .map(s -> s.trim().toUpperCase(Locale.ROOT))
                                .filter(s -> !s.isBlank())
                                .distinct()
                                .sorted()
                                .toList(),
                        List.of()),
                new AdminEstatisticasResponse.Metadados(
                        "Faturamento e ticket médio excluem pedidos CANCELADO. Quantidade e valor de itens também excluem cancelados, exceto quando CANCELADO é selecionado explicitamente no filtro de status.",
                        "Indisponível no schema atual: Produto não possui categoria/tipo canônico.",
                        Map.of(
                                "usuariosGlobais", FILTROS_PEDIDO,
                                "clientesTotal", FILTROS_PEDIDO,
                                "produtosGlobaisEEstoque", FILTROS_PEDIDO,
                                "movimentacoesUsuarios", FILTROS_NAO_APLICAVEIS_MOVIMENTACAO)));
    }

    public String relatorios() {
        return "Relatórios em desenvolvimento";
    }

    private static <T> AdminEstatisticasResponse.Pagina<T> pagina(
            List<T> conteudo, long totalElementos, int pagina, int tamanho) {
        int totalPaginas = totalElementos == 0 ? 0 : (int) Math.ceil((double) totalElementos / tamanho);
        return new AdminEstatisticasResponse.Pagina<>(conteudo, totalElementos, pagina, tamanho, totalPaginas);
    }

    private static long quantidadeStatus(
            List<AdminEstatisticasResponse.Distribuicao> distribuicao, String status) {
        return distribuicao.stream()
                .filter(item -> status.equalsIgnoreCase(item.nome()))
                .mapToLong(AdminEstatisticasResponse.Distribuicao::quantidade)
                .sum();
    }

    private static <T> List<T> lista(List<T> valor) {
        return valor == null ? List.of() : valor.stream().filter(Objects::nonNull).distinct().toList();
    }

    private static List<String> statusNormalizados(List<String> valores) {
        return lista(valores).stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.toUpperCase(Locale.ROOT))
                .distinct()
                .toList();
    }

    private static Object[] primeira(List<Object[]> rows) {
        return rows.isEmpty() ? new Object[]{0L, BigDecimal.ZERO, BigDecimal.ZERO, 0L} : rows.getFirst();
    }

    private static String str(Object valor) {
        return valor == null ? "Não informado" : valor.toString();
    }

    private static long inteiro(Object valor) {
        return valor == null ? 0 : ((Number) valor).longValue();
    }

    private static Integer numero(Object valor) {
        return valor == null ? null : ((Number) valor).intValue();
    }

    private static BigDecimal decimal(Object valor) {
        return valor == null
                ? BigDecimal.ZERO
                : valor instanceof BigDecimal decimal ? decimal : new BigDecimal(valor.toString());
    }
}
