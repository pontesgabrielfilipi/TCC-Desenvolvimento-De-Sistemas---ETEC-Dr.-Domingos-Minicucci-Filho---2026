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
    async listar() {
        return await api.get('/api/clientes');
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