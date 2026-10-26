import api from '../api/axiosInstance';

export type FiltroRelatorio = 'inicio' | 'fim' | 'clienteId' | 'produtoId' | 'usuarioId' | 'status';

export interface RelatorioDisponivel {
    id: string;
    categoria: string;
    titulo: string;
    descricao: string;
    filtros: FiltroRelatorio[];
}

export interface FiltrosRelatorio {
    inicio?: string;
    fim?: string;
    clienteId?: number;
    produtoId?: number;
    usuarioId?: number;
    status?: string;
}

export const relatoriosService = {
    async catalogo(): Promise<RelatorioDisponivel[]> {
        const response = await api.get<RelatorioDisponivel[]>('/api/admin/relatorios');
        return response.data;
    },

    async exportar(id: string, filtros: FiltrosRelatorio, signal?: AbortSignal): Promise<{ arquivo: Blob; exportId?: string }> {
        const response = await api.get<Blob>(`/api/admin/relatorios/${encodeURIComponent(id)}/xlsx`, {
            params: filtros,
            signal,
            responseType: 'blob',
            // A exportação pode consultar milhões de registros; o timeout padrão da API é 10 s.
            timeout: 0,
            headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        });
        return { arquivo: response.data, exportId: response.headers['x-export-id'] };
    },
};
