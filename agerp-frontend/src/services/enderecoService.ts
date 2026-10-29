// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import api from '../api/axiosInstance';

export interface Endereco {
    id?: number;
    idCliente?: number;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    latitude?: number | null;
    longitude?: number | null;
}

export const enderecoService = {
    async listarPorCliente(clienteId: number) {
        return await api.get<Endereco[]>(`/api/clientes/${clienteId}/enderecos`);
    },

    async buscarPorId(clienteId: number, id: number) {
        return await api.get<Endereco>(`/api/clientes/${clienteId}/enderecos/${id}`);
    },

    async criar(clienteId: number, endereco: Endereco) {
        return await api.post<Endereco>(`/api/clientes/${clienteId}/enderecos`, endereco);
    },

    async atualizar(clienteId: number, id: number, endereco: Endereco) {
        return await api.put<Endereco>(`/api/clientes/${clienteId}/enderecos/${id}`, endereco);
    },

    async excluir(clienteId: number, id: number) {
        return await api.delete(`/api/clientes/${clienteId}/enderecos/${id}`);
    },
};
