import api from '../api/axiosInstance';

export interface UsuarioCreateRequest {
    nome: string;
    email: string;
    senha: string;
    idPerfil: number;
}

export interface UsuarioUpdateRequest {
    nome: string;
    email: string;
    idPerfil: number;
}

export interface PerfilResponse {
    id: number;
    nome: string;
    descricao?: string;
}

export interface RedefinicaoSenhaResponse {
    senhaTemporaria: string;
    expiraEm: string;
}

export const usuarioService = {
    // Usado na página Admin
    async listarTodos(refresh = false) {
        return await api.get('/api/admin/usuarios', { params: refresh ? { refresh: true, _ts: Date.now() } : undefined });
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
        return await api.put(`/api/admin/usuarios/${id}`, usuario);
    },

    async listarPerfis() {
        return await api.get<PerfilResponse[]>('/api/admin/perfis');
    },

    async deletar(id: number) {
        return await api.delete(`/api/usuarios/${id}`);
    },

    async aprovar(id: number) {
        return await api.post(`/api/admin/usuarios/${id}/aprovar`);
    },

    async rejeitar(id: number) {
        return await api.post(`/api/admin/usuarios/${id}/rejeitar`);
    },

    async bloquear(id: number) {
        return await api.post(`/api/admin/usuarios/${id}/bloquear`);
    },

    async redefinirSenha(id: number) {
        return await api.post<RedefinicaoSenhaResponse>(`/api/admin/usuarios/${id}/redefinir-senha`);
    }
};
