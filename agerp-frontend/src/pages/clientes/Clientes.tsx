// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clienteService } from '../../services/clienteService';
import { EnderecosModal } from './EnderecosModal';
import { getHttpErrorMessage } from '../../utils/httpError';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';

interface Cliente {
    id: number;
    tipo: 'FISICA' | 'JURIDICA';
    nomeRazao: string;
    cpfCnpj: string;
    email: string;
    telefone: string;
    dataCadastro?: string;
}

interface Toast {
    id: number;
    type: 'success' | 'error';
    message: string;
}

const Clientes = () => {
    const isMobileViewport = useIsMobileViewport();

    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [busca, setBusca] = useState('');
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState<{ key: keyof Cliente; direction: 'asc' | 'desc' }>({ key: 'nomeRazao', direction: 'asc' });

    const [modalOpen, setModalOpen] = useState(false);
    const [editandoId, setEditandoId] = useState<number | null>(null);

    const [enderecosModalOpen, setEnderecosModalOpen] = useState(false);
    const [clienteSelecionadoEnderecos, setClienteSelecionadoEnderecos] = useState<Cliente | null>(null);

    const [formData, setFormData] = useState({
        tipo: 'FISICA' as 'FISICA' | 'JURIDICA',
        nomeRazao: '',
        cpfCnpj: '',
        email: '',
        telefone: ''
    });

    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);


    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((type: 'success' | 'error', message: string) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const carregarClientes = useCallback(async (refresh = false) => {
        try {
            setLoading(true);
            const response = await clienteService.listar(refresh);
            setClientes(response.data);
            if (refresh) showToast('success', 'Clientes atualizados com sucesso.');
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            showToast('error', 'Erro ao carregar lista de clientes');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        carregarClientes();
    }, [carregarClientes]);

    const clientesFiltrados = useMemo(() => {
        const termo = busca.trim().toLocaleLowerCase('pt-BR');
        const filtrados = clientes.filter(c => !termo || [c.id, c.nomeRazao, c.tipo, c.cpfCnpj, c.email, c.telefone]
            .some(valor => String(valor ?? '').toLocaleLowerCase('pt-BR').includes(termo)));
        return [...filtrados].sort((a, b) => {
            const av = a[sort.key] ?? '';
            const bv = b[sort.key] ?? '';
            const resultado = typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : String(av).localeCompare(String(bv), 'pt-BR', { numeric: true, sensitivity: 'base' });
            return sort.direction === 'asc' ? resultado : -resultado;
        });
    }, [busca, clientes, sort]);

    const ordenar = (key: keyof Cliente) => setSort(atual => ({
        key,
        direction: atual.key === key && atual.direction === 'asc' ? 'desc' : 'asc'
    }));
    const indicador = (key: keyof Cliente) => sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : '';

    const formatarTelefone = (value: string) =>
        value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 15);

    const formatarCpfCnpj = (value: string) => {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length <= 11) {
            return cleaned
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        }
        return cleaned
            .replace(/(\d{2})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1/$2')
            .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'telefone') {
            setFormData(prev => ({ ...prev, telefone: formatarTelefone(value) }));
        } else if (name === 'cpfCnpj') {
            setFormData(prev => ({ ...prev, cpfCnpj: formatarCpfCnpj(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const abrirModal = (cliente?: Cliente) => {
        if (cliente) {
            setEditandoId(cliente.id);
            setFormData({
                tipo: cliente.tipo,
                nomeRazao: cliente.nomeRazao,
                cpfCnpj: cliente.cpfCnpj,
                email: cliente.email,
                telefone: cliente.telefone,
            });
        } else {
            setEditandoId(null);
            setFormData({ tipo: 'FISICA', nomeRazao: '', cpfCnpj: '', email: '', telefone: '' });
        }
        setModalOpen(true);
    };

    const abrirEnderecos = (cliente: Cliente) => {
        setClienteSelecionadoEnderecos(cliente);
        setEnderecosModalOpen(true);
    };

    const fecharEnderecos = () => {
        setEnderecosModalOpen(false);
        setClienteSelecionadoEnderecos(null);
    };

    const fecharModal = () => {
        setModalOpen(false);
        setEditandoId(null);
    };

    const validarCPF = (cpf: string) => {
        const cleaned = cpf.replace(/\D/g, '');
        if (cleaned.length !== 11 || /^(\d)\1+$/.test(cleaned)) return false;
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
        let rest = (sum * 10) % 11;
        if (rest === 10 || rest === 11) rest = 0;
        if (rest !== parseInt(cleaned[9])) return false;
        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
        rest = (sum * 10) % 11;
        if (rest === 10 || rest === 11) rest = 0;
        return rest === parseInt(cleaned[10]);
    };

    const validarCNPJ = (cnpj: string) => {
        const cleaned = cnpj.replace(/\D/g, '');
        if (cleaned.length !== 14 || /^(\d)\1+$/.test(cleaned)) return false;
        return true;
    };

    const salvarCliente = async () => {
        if (!formData.nomeRazao.trim()) {
            showToast('error', 'Nome / Razão Social é obrigatório');
            return;
        }
        if (formData.tipo === 'FISICA' && !validarCPF(formData.cpfCnpj)) {
            showToast('error', 'CPF inválido');
            return;
        }
        if (formData.tipo === 'JURIDICA' && !validarCNPJ(formData.cpfCnpj)) {
            showToast('error', 'CNPJ inválido');
            return;
        }

        try {
            if (editandoId) {
                await clienteService.atualizar(editandoId, formData);
                showToast('success', 'Cliente atualizado com sucesso!');
            } else {
                await clienteService.criar(formData);
                showToast('success', 'Cliente cadastrado com sucesso!');
            }
            fecharModal();
            await carregarClientes(true);
        } catch (error) {
            showToast('error', `Erro ao salvar cliente ${error}`);
        }
    };

    const confirmarExclusao = (id: number) => setDeleteConfirmId(id);

    const executarExclusao = async () => {
        if (!deleteConfirmId) return;
        try {
            await clienteService.excluir(deleteConfirmId);
            showToast('success', 'Cliente excluído com sucesso!');
            carregarClientes();
        } catch (error) {
            showToast('error', getHttpErrorMessage(error, 'Erro ao excluir cliente'));
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const campoBusca = (
        <input
            type="text"
            placeholder="Buscar por nome ou CPF/CNPJ..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar clientes"
            className={isMobileViewport
                ? 'mb-3 block w-full min-w-0 rounded-2xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none'
                : 'min-w-0 w-72 rounded-2xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none'}
        />
    );

    return (
        <div className="h-full min-w-0 bg-app-background flex overflow-hidden">

            <div className="flex-1 flex flex-col overflow-hidden">

                <header className="bg-white border-b px-3 sm:px-6 py-3 sm:py-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="hidden items-center gap-4 sm:flex">
                        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">👥 Clientes</h1>
                    </div>

                    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:gap-4">
                        {!isMobileViewport && campoBusca}
                        <button
                            onClick={() => void carregarClientes(true)}
                            disabled={loading}
                            className="min-h-11 flex-1 whitespace-nowrap rounded-2xl border border-gray-300 px-3 py-3 font-medium hover:bg-gray-50 disabled:opacity-50 sm:flex-none sm:px-4"
                        >{loading ? 'Atualizando...' : '↻ Atualizar'}</button>
                        <button
                            onClick={() => abrirModal()}
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-indigo-600 px-3 py-3 font-medium text-white transition-all duration-300 ease-in-out hover:scale-105 hover:bg-indigo-700 hover:shadow-lg sm:flex-none sm:px-6"
                        >
                            + Novo Cliente
                        </button>
                    </div>
                </header>

                <div data-testid="clientes-scroll" className="min-w-0 p-3 sm:p-6 md:p-8 flex-1 overflow-y-auto overflow-x-hidden">
                    {isMobileViewport && campoBusca}
                    {loading ? (
                        <div className="text-center py-16 text-gray-500 font-medium">Carregando clientes...</div>
                    ) : clientesFiltrados.length === 0 ? (
                        <div className="rounded-3xl bg-white p-8 text-center text-gray-500 shadow-sm">Nenhum cliente encontrado.</div>
                    ) : (<>
                        <div className="mb-3 flex items-center gap-2 md:hidden">
                            <label htmlFor="ordenacao-clientes-mobile" className="shrink-0 text-sm font-medium text-gray-600">Ordenar:</label>
                            <select id="ordenacao-clientes-mobile" value={String(sort.key)} onChange={(event) => setSort(atual => ({ ...atual, key: event.target.value as keyof Cliente }))} className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm">
                                <option value="nomeRazao">Nome</option><option value="tipo">Tipo</option><option value="cpfCnpj">CPF/CNPJ</option><option value="email">E-mail</option><option value="telefone">Telefone</option>
                            </select>
                            <button type="button" onClick={() => setSort(atual => ({ ...atual, direction: atual.direction === 'asc' ? 'desc' : 'asc' }))} className="min-h-11 min-w-11 rounded-xl border border-gray-300 bg-white px-3" aria-label={`Ordem ${sort.direction === 'asc' ? 'crescente' : 'decrescente'}; alternar direção`}>{sort.direction === 'asc' ? '↑' : '↓'}</button>
                        </div>
                        <div className="grid gap-3 md:hidden" aria-label="Lista de clientes">
                            {clientesFiltrados.map((cliente) => (
                                <article key={cliente.id} className="agerp-mobile-card rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                        <h2 className="min-w-0 break-words font-semibold text-gray-900">{cliente.nomeRazao}</h2>
                                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${cliente.tipo === 'FISICA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{cliente.tipo === 'FISICA' ? 'Física' : 'Jurídica'}</span>
                                    </div>
                                    <dl className="mt-4 grid min-w-0 gap-3 text-sm">
                                        <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">CPF / CNPJ</dt><dd className="mt-0.5 break-all font-mono text-gray-800">{cliente.cpfCnpj || '—'}</dd></div>
                                        <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">E-mail</dt><dd className="mt-0.5 break-all text-gray-800">{cliente.email || '—'}</dd></div>
                                        <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Telefone</dt><dd className="mt-0.5 break-words text-gray-800">{cliente.telefone || '—'}</dd></div>
                                    </dl>
                                    <div className="mt-4 grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
                                        <button onClick={() => abrirEnderecos(cliente)} className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">📍 Endereços</button>
                                        <button onClick={() => abrirModal(cliente)} className="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">Editar</button>
                                        <button onClick={() => confirmarExclusao(cliente.id)} className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Excluir</button>
                                    </div>
                                </article>
                            ))}
                        </div>
                        <div className="hidden rounded-3xl bg-white shadow-sm md:block md:overflow-x-auto" role="region" aria-label="Tabela de clientes" tabIndex={0}>
                        <table className="w-full min-w-[800px]">
                            <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-4 text-left"><button onClick={() => ordenar('nomeRazao')}>Nome / Razão Social{indicador('nomeRazao')}</button></th>
                                <th className="px-6 py-4 text-left"><button onClick={() => ordenar('tipo')}>Tipo{indicador('tipo')}</button></th>
                                <th className="px-6 py-4 text-left"><button onClick={() => ordenar('cpfCnpj')}>CPF / CNPJ{indicador('cpfCnpj')}</button></th>
                                <th className="px-6 py-4 text-left"><button onClick={() => ordenar('email')}>E-mail{indicador('email')}</button></th>
                                <th className="px-6 py-4 text-left"><button onClick={() => ordenar('telefone')}>Telefone{indicador('telefone')}</button></th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y">
                            {clientesFiltrados.map((cliente) => (
                                <tr key={cliente.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4 font-medium">{cliente.nomeRazao}</td>
                                    <td className="px-6 py-4">
                                            <span className={`px-3 py-1 text-xs rounded-full ${cliente.tipo === 'FISICA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                {cliente.tipo === 'FISICA' ? 'Física' : 'Jurídica'}
                                            </span>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-sm">{cliente.cpfCnpj}</td>
                                    <td className="px-6 py-4">{cliente.email}</td>
                                    <td className="px-6 py-4">{cliente.telefone}</td>
                                    <td className="px-6 py-4 text-center space-x-3 whitespace-nowrap">
                                        <button
                                            onClick={() => abrirEnderecos(cliente)}
                                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition inline-flex items-center gap-1"
                                            title="Gerenciar endereços do cliente"
                                        >
                                            📍 Endereços
                                        </button>
                                        <button onClick={() => abrirModal(cliente)} className="text-indigo-600 hover:text-indigo-700 font-medium text-sm">Editar</button>
                                        <button onClick={() => confirmarExclusao(cliente.id)} className="text-red-600 hover:text-red-700 font-medium text-sm">Excluir</button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                    </>)}
                </div>
            </div>

            {modalOpen && (
                <div className="agerp-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="cliente-modal-titulo">
                    <div className="agerp-modal-panel w-full max-w-lg rounded-3xl bg-white p-4 sm:p-8">
                        <h2 className="text-2xl font-semibold mb-6">
                            <span id="cliente-modal-titulo">
                            {editandoId ? 'Editar Cliente' : 'Novo Cliente'}
                            </span>
                        </h2>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cliente</label>
                                <select
                                    name="tipo"
                                    value={formData.tipo}
                                    onChange={handleChange}
                                    className="w-full rounded-2xl border border-gray-300 py-3 px-4"
                                >
                                    <option value="FISICA">Pessoa Física</option>
                                    <option value="JURIDICA">Pessoa Jurídica</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {formData.tipo === 'FISICA' ? 'CPF' : 'CNPJ'} *
                                </label>
                                <input
                                    type="text"
                                    name="cpfCnpj"
                                    value={formData.cpfCnpj}
                                    onChange={handleChange}
                                    className="w-full rounded-2xl border border-gray-300 py-3 px-4"
                                    placeholder={formData.tipo === 'FISICA' ? '000.000.000-00' : '00.000.000/0000-00'}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome / Razão Social *</label>
                                <input
                                    type="text"
                                    name="nomeRazao"
                                    value={formData.nomeRazao}
                                    onChange={handleChange}
                                    className="w-full rounded-2xl border border-gray-300 py-3 px-4"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-gray-300 py-3 px-4"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                                    <input
                                        type="tel"
                                        name="telefone"
                                        value={formData.telefone}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-gray-300 py-3 px-4"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:gap-4">
                                <button onClick={fecharModal} className="flex-1 py-3.5 border border-gray-300 rounded-2xl font-medium">Cancelar</button>
                                <button onClick={salvarCliente} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl font-medium hover:bg-indigo-700">Salvar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirmId && (
                <div className="agerp-modal-overlay fixed inset-0 z-[110] flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="excluir-cliente-titulo">
                    <div className="agerp-modal-panel w-full max-w-sm rounded-3xl bg-white p-5 sm:p-8">
                        <h3 id="excluir-cliente-titulo" className="text-lg font-semibold">Confirmar exclusão</h3>
                        <p className="text-gray-600 mt-2 mb-8">Esta ação não pode ser desfeita.</p>
                        <div className="flex flex-col gap-3 min-[360px]:flex-row">
                            <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3.5 border border-gray-300 rounded-2xl">Cancelar</button>
                            <button onClick={executarExclusao} className="flex-1 py-3.5 bg-red-600 text-white rounded-2xl">Excluir</button>
                        </div>
                    </div>
                </div>
            )}

            <EnderecosModal
                isOpen={enderecosModalOpen}
                cliente={clienteSelecionadoEnderecos}
                onClose={fecharEnderecos}
                showToast={showToast}
            />

            <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[120] space-y-2 sm:left-auto sm:right-6 sm:max-w-md">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`px-6 py-4 rounded-2xl shadow-xl text-white flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
                    >
                        {toast.type === 'success' ? '✅' : '❌'}
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Clientes;
