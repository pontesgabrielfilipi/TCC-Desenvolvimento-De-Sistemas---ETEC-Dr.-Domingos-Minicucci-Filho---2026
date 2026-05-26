import api from '../api/axiosInstance';   // ou o axios configurado que você usa

export const dashboardService = {
    /**
     * Busca TODOS os dados do dashboard (estatísticas + gráficos)
     */
    async getRelatorioCompleto() {
        return await api.get('/api/dashboard/relatorio-completo');
    },

    /**
     * Mantém compatibilidade com o método antigo
     */
    async getEstatisticasBasicas() {
        return await api.get('/api/dashboard/estatisticas');
    }
};