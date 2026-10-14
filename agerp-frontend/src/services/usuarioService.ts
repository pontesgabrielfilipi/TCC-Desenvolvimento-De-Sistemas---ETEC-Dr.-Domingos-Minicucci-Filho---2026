import api from '../api/axiosInstance';

export interface UsuarioCreateRequest {
    nome: string;
    email: string;
    senha: string;
    idPerfil: number;
}

export interface UsuarioUpdateRequest {
    nome?: string;
    email?: string;
    idPerfil?: number;
}

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

    async criar(usuario: UsuarioCreateRequest) {
        return await api.post('/api/usuarios', usuario);
    },

    async atualizar(id: number, usuario: UsuarioUpdateRequest) {
        return await api.put(`/api/usuarios/${id}`, usuario);
    },

    async deletar(id: number) {
        return await api.delete(`/api/usuarios/${id}`);
    }
};
