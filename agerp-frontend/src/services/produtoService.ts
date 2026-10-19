import api from '../api/axiosInstance.ts';   // ← importa o axios configurado que você acabou de enviar

export interface ProdutoCreateRequest {
    nome: string;
    descricao: string;
    preco: number;
    custo: number;
    peso: number;
    volume: number;
    quantidadeInicial: number;
    quantidadeMinima: number;
}

export interface ProdutoUpdateRequest extends Omit<ProdutoCreateRequest, 'quantidadeInicial'> {
    ativo: boolean;
    quantidadeAtual: number;
}

export const produtoService = {
    async listar(refresh = false) {
        return await api.get('/api/produtos', { params: refresh ? { refresh: true, _ts: Date.now() } : undefined });
    },

    async criar(payload: ProdutoCreateRequest) {
        return await api.post('/api/produtos', payload);
    },

    async atualizar(id: number, payload: ProdutoUpdateRequest) {
        return await api.put(`/api/produtos/${id}`, payload);
    },

    async excluir(id: number) {
        return await api.delete(`/api/produtos/${id}`);
    }
};
