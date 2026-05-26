import api from '../api/axiosInstance.ts';   // ← importa o axios configurado que você acabou de enviar

export const produtoService = {
    async listar() {
        return await api.get('/api/produtos');
    },

    async criar(payload: any) {
        return await api.post('/api/produtos', payload);
    },

    async atualizar(id: number, payload: any) {
        return await api.put(`/api/produtos/${id}`, payload);
    },

    async excluir(id: number) {
        return await api.delete(`/api/produtos/${id}`);
    }
};