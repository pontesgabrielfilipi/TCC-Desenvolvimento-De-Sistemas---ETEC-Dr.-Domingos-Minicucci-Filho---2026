import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8080',
    withCredentials: true,
});

export const logService = {
    async listarTodos() {
        return await api.get('/api/admin/logs');
    },

    async listarPorUsuario(usuarioId: number) {
        return await api.get(`/api/admin/logs/usuario/${usuarioId}`);
    }
};