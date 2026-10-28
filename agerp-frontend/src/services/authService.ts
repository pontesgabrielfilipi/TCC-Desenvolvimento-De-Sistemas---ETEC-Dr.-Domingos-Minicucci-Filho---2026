// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import api from '../api/axiosInstance';

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.warn('🔴 Token inválido ou sessão expirada');
        }
        return Promise.reject(error);
    }
);

export const authService = {
    async login(email: string, senha: string) {
        return await api.post('/api/auth/login', { email, senha });
    },

    async logout() {
        return await api.post('/api/auth/logout');
    },

    async getCurrentUser() {
        return await api.get('/api/auth/me');
    },

    async alterarSenhaObrigatoria(senha: string, confirmacaoSenha: string) {
        return await api.post('/api/auth/alterar-senha-obrigatoria', { senha, confirmacaoSenha });
    },

    async getDashboardStats() {
        return await api.get('/api/dashboard/estatisticas');
    },

    async getRelatorioCompleto() {
        return await api.get('/api/dashboard/relatorio-completo');
    },
};
