import api from '../api/axiosInstance.ts';

export interface LogSistema {
    id: number;
    acao: string;
    entidade: string;
    dataHora: string;
    ip?: string | null;
    nomeUsuario?: string | null;
    emailUsuario?: string | null;
    perfilUsuario?: string | null;
    idUsuario?: number | null;
    usuarioNome?: string | null;
    usuarioEmail?: string | null;
    usuarioPerfil?: string | null;
    recursoId?: string | number | null;
    resultado?: string | null;
    detalhes?: string | null;
    requestId?: string | null;
    sessionRef?: string | null;
    deviceRef?: string | null;
    correlationId?: string | null;
    userAgent?: string | null;
    peerIp?: string | null;
    httpMethod?: string | null;
    httpRoute?: string | null;
    httpStatus?: number | null;
    changesJson?: Record<string, unknown> | null;
    origemConfianca?: string | null;
    identidadeHistoricaConfirmada?: boolean;
}

export interface LogFiltros {
    page?: number;
    size?: number;
    email?: string;
    resultado?: string;
    entidade?: string;
    recursoId?: string;
    sessionRef?: string;
    requestId?: string;
    ip?: string;
    perfil?: string;
    acao?: string;
    search?: string;
    fields?: Array<'email' | 'perfil' | 'acao' | 'entidade' | 'ip'>;
    dataInicio?: string;
    dataFim?: string;
    sortBy?: 'dataHora' | 'acao' | 'entidade' | 'id';
    direction?: 'asc' | 'desc';
}

export interface PaginaLogs {
    content: LogSistema[];
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
}

export const logService = {
    async listar(filtros: LogFiltros = {}) {
        const { dataInicio, dataFim, ...demaisFiltros } = filtros;
        const inicio = dataInicio ? new Date(`${dataInicio}T00:00:00`).toISOString() : undefined;
        const fim = dataFim ? new Date(`${dataFim}T23:59:59.999`).toISOString() : undefined;
        return api.get<PaginaLogs>('/api/admin/logs', {
            params: {
                ...demaisFiltros,
                fields: demaisFiltros.fields?.join(',') || undefined,
                inicio,
                fim
            }
        });
    },

    async listarTodos() {
        return this.listar({ page: 0, size: 20 });
    },

    // Consulta por e-mail histórico via listar({email}), sem rota órfã.
};
