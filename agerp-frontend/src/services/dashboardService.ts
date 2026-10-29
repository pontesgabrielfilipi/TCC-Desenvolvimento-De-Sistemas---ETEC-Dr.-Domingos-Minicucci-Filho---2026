// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import api from '../api/axiosInstance';

export const dashboardService = {
    async getRelatorioCompleto(refresh = false) {
        return await api.get('/api/dashboard/relatorio-completo', {
            params: refresh ? { refresh: true, _ts: Date.now() } : undefined
        });
    },

    async getEstatisticasBasicas() {
        return await api.get('/api/dashboard/estatisticas');
    },

    /** Lista completa e atual de produtos abaixo do mínimo calculado pelo backend. */
    async listarEstoqueBaixo() {
        return await api.get<Array<{ nome: string; quantidade: number; minimo: number }>>('/api/dashboard/estoque-baixo');
    }
};
