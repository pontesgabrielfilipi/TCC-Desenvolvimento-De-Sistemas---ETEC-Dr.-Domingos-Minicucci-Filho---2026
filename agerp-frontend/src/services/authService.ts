import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
    withCredentials: true,
});

// Tratamento global de erro 401 (token expirado)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.warn('🔴 Token inválido ou sessão expirada');
            // Opcional: redirecionar para login automaticamente
        }
        return Promise.reject(error);
    }
);

export const authService = {
    // ==================== AUTENTICAÇÃO ====================
    async login(email: string, senha: string) {
        return await api.post('/api/auth/login', { email, senha });
    },

    async logout() {
        return await api.post('/api/auth/logout');
    },

    async getCurrentUser() {
        return await api.get('/api/auth/me');
    },

    // ==================== DASHBOARD ====================
    async getDashboardStats() {
        return await api.get('/api/dashboard/estatisticas');
    },

    // ✅ Novo método necessário para o Dashboard atualizado
    async getRelatorioCompleto() {
        return await api.get('/api/dashboard/relatorio-completo');
    },
};