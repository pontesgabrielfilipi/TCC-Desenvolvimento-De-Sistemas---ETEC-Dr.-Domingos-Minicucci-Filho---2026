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
    }
};
