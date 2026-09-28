import api from '../api/axiosInstance.ts';   // ← importa o axios configurado que você acabou de enviar

export const logService = {
    async listarTodos() {
        return await api.get('/api/admin/logs');
    },

    async listarPorUsuario(usuarioId: number) {
        return await api.get(`/api/admin/logs/usuario/${usuarioId}`);
    }
};