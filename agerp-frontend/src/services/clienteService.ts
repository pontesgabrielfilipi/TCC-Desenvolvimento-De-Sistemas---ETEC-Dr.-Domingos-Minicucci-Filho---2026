// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import api from '../api/axiosInstance';

interface Cliente {
    id?: number;
    tipo?: string;
    nomeRazao: string;
    cpfCnpj?: string;
    email?: string;
    telefone?: string;
}

export const clienteService = {
    async listar(refresh = false) {
        return await api.get('/api/clientes', { params: refresh ? { refresh: true, _ts: Date.now() } : undefined });
    },

    async buscarPorId(id: number) {
        return await api.get(`/api/clientes/${id}`);
    },

    async criar(cliente: Cliente) {
        return await api.post('/api/clientes', cliente);
    },

    async atualizar(id: number, cliente: Cliente) {
        return await api.put(`/api/clientes/${id}`, cliente);
    },

    async excluir(id: number) {
        return await api.delete(`/api/clientes/${id}`);
    },
};
