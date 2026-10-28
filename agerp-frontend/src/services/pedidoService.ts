// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import api from '../api/axiosInstance';

export interface ItemPedidoRequest {
    idProduto: number;
    quantidade: number;
}

export interface ItemPedidoResponse {
    id: number;
    idProduto: number;
    nomeProduto: string;
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
}

export interface PedidoResponse {
    id: number;
    idCliente: number;
    nomeCliente: string;
    idEndereco?: number | null;
    enderecoResumo?: string | null;
    dataPedido: string;
    status: string;
    valorTotal: number;
    idUsuario: number | null;
    nomeUsuario: string | null;
    observacoes: string | null;
    itens: ItemPedidoResponse[];
}

export interface PedidoCreateRequest {
    idCliente: number;
    idEndereco?: number | null;
    itens: ItemPedidoRequest[];
    observacoes?: string;
}

export interface PedidoUpdateRequest {
    idCliente: number;
    idEndereco?: number | null;
    itens: ItemPedidoRequest[];
    observacoes?: string;
}

export interface PrevisaoEntregaResponse {
    idPedido: number;
    prazoMinimoDias: number;
    prazoMaximoDias: number;
    estimativaCentralDias: number;
    status: string;
    cidadeOrigem: string;
    estadoOrigem: string;
    cidadeDestino: string;
    estadoDestino: string;
    distanciaKm: number;
    dataCalculo: string;
    modeloVersao: string;
    mensagem: string;
}

export const pedidoService = {
    async listar(refresh = false) {
        return await api.get<PedidoResponse[]>('/api/pedidos', { params: refresh ? { refresh: true, _ts: Date.now() } : undefined });
    },

    async listarPorStatus(status: string) {
        return await api.get<PedidoResponse[]>(`/api/pedidos/status/${status}`);
    },

    async listarPorCliente(idCliente: number) {
        return await api.get<PedidoResponse[]>(`/api/pedidos/cliente/${idCliente}`);
    },

    async buscarPorId(id: number) {
        return await api.get<PedidoResponse>(`/api/pedidos/${id}`);
    },

    async criar(payload: PedidoCreateRequest) {
        return await api.post<PedidoResponse>('/api/pedidos', payload);
    },

    async atualizar(id: number, payload: PedidoUpdateRequest) {
        return await api.put<PedidoResponse>(`/api/pedidos/${id}`, payload);
    },

    async mudarStatus(id: number, status: string) {
        return await api.patch<PedidoResponse>(`/api/pedidos/${id}/status`, null, {
            params: { status }
        });
    },

    async cancelar(id: number) {
        return await api.post<PedidoResponse>(`/api/pedidos/${id}/cancelar`);
    },

    async deletar(id: number) {
        return await api.delete(`/api/pedidos/${id}`);
    },

    async obterPrevisaoEntrega(id: number) {
        return await api.get<PrevisaoEntregaResponse>(`/api/pedidos/${id}/previsao-entrega`);
    }
};
