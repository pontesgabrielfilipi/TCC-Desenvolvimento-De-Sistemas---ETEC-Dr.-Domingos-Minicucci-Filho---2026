import api from '../api/axiosInstance';

export interface ItemQuantidade { nome: string; quantidade: number }
export interface ItemEvolucao { periodo: string; quantidade: number; valor: number }
export interface ItemDesempenho { id: number; nome: string; pedidos: number; faturamento: number }
export interface ItemProduto { id: number; nome: string; quantidade: number; valor: number }
export interface MovimentacaoUsuario { id: number; nome: string; movimentacoes: number; quantidadeSaida: number; quantidadeEntrada: number }
export interface EvolucaoCliente { periodo: string; id: number; nome: string; pedidos: number; faturamento: number }

export interface Pagina<T> {
    conteudo: T[];
    totalElementos: number;
    pagina: number;
    tamanho: number;
    totalPaginas: number;
}

export interface AdminEstatisticas {
    usuarios: {
        total: number; ativos: number; pendentes: number; bloqueados: number;
        distribuicaoPerfis: ItemQuantidade[];
        desempenho: Pagina<ItemDesempenho>;
        movimentacoes: Pagina<MovimentacaoUsuario>;
    };
    clientes: {
        total: number;
        comPedidos: number;
        topFrequentes: Pagina<ItemDesempenho>;
        evolucao: EvolucaoCliente[];
    };
    produtos: {
        total: number; quantidadeVendida: number; valorVendido: number;
        estoqueDisponivel: number; estoqueBaixo: number; topVendidos: Pagina<ItemProduto>;
    };
    pedidos: {
        total: number;
        pendentes: number;
        emAndamento: number;
        concluidos: number;
        cancelados: number;
        faturamento: number;
        ticketMedio: number;
        distribuicaoStatus: ItemQuantidade[];
        evolucaoMensal: ItemEvolucao[];
    };
    filtrosDisponiveis: { statusPedidos: string[]; categoriasProduto: string[] };
    metadados: {
        regraFaturamento?: string;
        categoriaProduto?: string;
        filtrosNaoAplicaveis?: Record<string, string[]>;
    };
}

export interface FiltrosAdminEstatisticas {
    usuarioIds?: number[];
    clienteIds?: number[];
    statusPedidos?: string[];
    inicio?: string;
    fim?: string;
    paginaProdutos?: number;
    paginaUsuarios?: number;
    paginaClientes?: number;
    paginaMovimentacoes?: number;
    tamanhoPagina?: number;
}

export const adminEstatisticasService = {
    async obter(filtros: FiltrosAdminEstatisticas = {}, refresh = false) {
        return api.get<AdminEstatisticas>('/api/admin/estatisticas', {
            params: {
                usuarioIds: filtros.usuarioIds?.join(',') || undefined,
                clienteIds: filtros.clienteIds?.join(',') || undefined,
                statusPedidos: filtros.statusPedidos?.join(',') || undefined,
                inicio: filtros.inicio,
                fim: filtros.fim,
                paginaProdutos: filtros.paginaProdutos,
                paginaUsuarios: filtros.paginaUsuarios,
                paginaClientes: filtros.paginaClientes,
                paginaMovimentacoes: filtros.paginaMovimentacoes,
                tamanhoPagina: filtros.tamanhoPagina,
                refresh: refresh || undefined,
                _ts: refresh ? Date.now() : undefined,
            }
        });
    }
};
