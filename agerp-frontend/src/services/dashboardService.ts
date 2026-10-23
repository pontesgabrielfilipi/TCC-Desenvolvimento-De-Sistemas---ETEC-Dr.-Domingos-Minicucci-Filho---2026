import api from '../api/axiosInstance';   // ou o axios configurado que você usa

export const dashboardService = {
    /**
     * Busca TODOS os dados do dashboard (estatísticas + gráficos)
     */
    async getRelatorioCompleto(refresh = false) {
        return await api.get('/api/dashboard/relatorio-completo', {
            params: refresh ? { refresh: true, _ts: Date.now() } : undefined
        });
    },

    /**
     * Mantém compatibilidade com o método antigo
     */
    async getEstatisticasBasicas() {
        return await api.get('/api/dashboard/estatisticas');
    },

    /** Lista completa e atual de produtos abaixo do mínimo calculado pelo backend. */
    async listarEstoqueBaixo() {
        return await api.get<Array<{ nome: string; quantidade: number; minimo: number }>>('/api/dashboard/estoque-baixo');
    }
};
