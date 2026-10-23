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
}

export interface LogFiltros {
    page?: number;
    size?: number;
    email?: string;
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

    async listarPorUsuario(usuarioId: number) {
        return api.get<LogSistema[]>(`/api/admin/logs/usuario/${usuarioId}`);
    }
};
