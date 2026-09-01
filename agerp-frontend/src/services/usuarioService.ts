import api from '../api/axiosInstance';

export const usuarioService = {
    // Usado na página Admin
    async listarTodos() {
        return await api.get('/api/admin/usuarios');
    },

    async listarAtivos() {
        return await api.get('/api/admin/usuarios/ativos');
    },

    async buscarPorId(id: number) {
        return await api.get(`/api/usuarios/${id}`);
    },

    async criar(usuario: any) {
        return await api.post('/api/usuarios', usuario);
    },

    async atualizar(id: number, usuario: any) {
        return await api.put(`/api/usuarios/${id}`, usuario);
    },

    async deletar(id: number) {
        return await api.delete(`/api/usuarios/${id}`);
    }
};