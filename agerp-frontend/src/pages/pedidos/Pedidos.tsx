import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { pedidoService } from '../../services/pedidoService';
import type { PedidoResponse, ItemPedidoRequest, PedidoCreateRequest, PedidoUpdateRequest } from '../../services/pedidoService';
import { produtoService } from '../../services/produtoService';
import { clienteService } from '../../services/clienteService';

interface Produto {
    id: number;
    nome: string;
    preco: number;
    ativo: boolean;
}

interface Cliente {
    id: number;
    nomeRazao: string;
}

interface Toast {
    id: number;
    type: 'success' | 'error';
    message: string;
}

const Pedidos = () => {
    const { user, logout } = useAuth();

    const [pedidos, setPedidos] = useState<PedidoResponse[]>([]);
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState<string>('');
    const [filtroCliente, setFiltroCliente] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [editandoId, setEditandoId] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        idCliente: '',
        itens: [] as Array<{ idProduto: string; quantidade: string }>,
        observacoes: ''
    });

    // Popover de exclusão/ação
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [statusChangeId, setStatusChangeId] = useState<number | null>(null);
    const [newStatus, setNewStatus] = useState<string>('');

    // Toasts
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (type: 'success' | 'error', message: string) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    // Carregar dados
    const carregarPedidos = async () => {
        try {
            setLoading(true);
            const response = await pedidoService.listar();
            setPedidos(response.data);
        } catch (error) {
            console.error('Erro ao carregar pedidos:', error);
            showToast('error', 'Erro ao carregar lista de pedidos');
        } finally {
            setLoading(false);
        }
    };

    const carregarProdutos = async () => {
        try {
            const response = await produtoService.listar();
            setProdutos(response.data);
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
        }
    };

    const carregarClientes = async () => {
        try {
            const response = await clienteService.listar();
            setClientes(response.data);
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
        }
    };

    useEffect(() => {
        carregarPedidos();
        carregarProdutos();
        carregarClientes();
    }, []);

    // Filtrar pedidos
    const pedidosFiltrados = pedidos.filter(p => {
        const matchBusca = p.id.toString().includes(busca) || 
                          p.nomeCliente.toLowerCase().includes(busca.toLowerCase());
        const matchStatus = filtroStatus === '' || p.status === filtroStatus;
        const matchCliente = filtroCliente === '' || p.idCliente.toString() === filtroCliente;
        return matchBusca && matchStatus && matchCliente;
    });

    // Formatar moeda
    const formatarMoeda = (valor: number | null | undefined): string => {
        if (valor === null || valor === undefined || isNaN(valor)) {
            return 'R$ 0,00';
        }
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    };

    // Formatar data
    const formatarData = (data: string | null | undefined): string => {
        if (!data) return '-';
        return new Date(data).toLocaleDateString('pt-BR');
    };

    // Adicionar item ao pedido
    const adicionarItem = () => {
        setFormData(prev => ({
            ...prev,
            itens: [...prev.itens, { idProduto: '', quantidade: '' }]
        }));
    };

    // Remover item do pedido
    const removerItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            itens: prev.itens.filter((_, i) => i !== index)
        }));
    };

    // Atualizar item
    const atualizarItem = (index: number, campo: 'idProduto' | 'quantidade', valor: string) => {
        setFormData(prev => ({
            ...prev,
            itens: prev.itens.map((item, i) =>
                i === index ? { ...item, [campo]: valor } : item
            )
        }));
    };

    // Calcular total
    const calcularTotal = (): number => {
        return formData.itens.reduce((total, item) => {
            const produto = produtos.find(p => p.id.toString() === item.idProduto);
            const quantidade = parseInt(item.quantidade) || 0;
            return total + (produto ? produto.preco * quantidade : 0);
        }, 0);
    };

    // Abrir modal
    const abrirModal = (pedido?: PedidoResponse) => {
        if (pedido) {
            setEditandoId(pedido.id);
            setFormData({
                idCliente: pedido.idCliente.toString(),
                itens: pedido.itens.map(item => ({
                    idProduto: item.idProduto.toString(),
                    quantidade: item.quantidade.toString()
                })),
                observacoes: pedido.observacoes || ''
            });
        } else {
            setEditandoId(null);
            setFormData({
                idCliente: '',
                itens: [],
                observacoes: ''
            });
        }
        setModalOpen(true);
    };

    // Fechar modal
    const fecharModal = () => {
        setModalOpen(false);
        setEditandoId(null);
    };

    // Validar formulário
    const validarFormulario = (): boolean => {
        if (!formData.idCliente) {
            showToast('error', 'Selecione um cliente');
            return false;
        }
        if (formData.itens.length === 0) {
            showToast('error', 'Adicione pelo menos um produto');
            return false;
        }
        for (let i = 0; i < formData.itens.length; i++) {
            const item = formData.itens[i];
            if (!item.idProduto) {
                showToast('error', `Selecione um produto no item ${i + 1}`);
                return false;
            }
            const quantidade = parseInt(item.quantidade);
            if (!item.quantidade || quantidade <= 0) {
                showToast('error', `Quantidade deve ser maior que zero no item ${i + 1}`);
                return false;
            }
        }
        return true;
    };

    // Salvar pedido
    const salvarPedido = async () => {
        if (!validarFormulario()) return;

        try {
            const itens: ItemPedidoRequest[] = formData.itens.map(item => ({
                idProduto: parseInt(item.idProduto),
                quantidade: parseInt(item.quantidade)
            }));

            const payload = {
                idCliente: parseInt(formData.idCliente),
                itens,
                observacoes: formData.observacoes || undefined
            };

            if (editandoId) {
                await pedidoService.atualizar(editandoId, payload as PedidoUpdateRequest);
                showToast('success', 'Pedido atualizado com sucesso!');
            } else {
                await pedidoService.criar(payload as PedidoCreateRequest);
                showToast('success', 'Pedido criado com sucesso!');
            }

            fecharModal();
            carregarPedidos();
        } catch (error: any) {
            showToast('error', error.response?.data?.message || 'Erro ao salvar pedido');
        }
    };

    // Confirmar exclusão
    const confirmarExclusao = (id: number) => setDeleteConfirmId(id);

    // Executar exclusão
    const executarExclusao = async () => {
        if (!deleteConfirmId) return;
        try {
            await pedidoService.deletar(deleteConfirmId);
            showToast('success', 'Pedido excluído com sucesso!');
            carregarPedidos();
        } catch (error) {
            showToast('error', 'Erro ao excluir pedido');
        } finally {
            setDeleteConfirmId(null);
        }
    };

    // Mudar status
    const abrirMudancaStatus = (id: number, statusAtual: string) => {
        setStatusChangeId(id);
        setNewStatus('');
    };

    const transicoes: Record<string, string[]> = {
        'PENDENTE': ['CONFIRMADO', 'CANCELADO'],
        'CONFIRMADO': ['EM_PREPARACAO', 'CANCELADO'],
        'EM_PREPARACAO': ['PRONTO', 'CANCELADO'],
        'PRONTO': ['ENTREGUE', 'CANCELADO'],
        'ENTREGUE': [],
        'CANCELADO': []
    };

    const executarMudancaStatus = async () => {
        if (!statusChangeId || !newStatus) return;
        try {
            await pedidoService.mudarStatus(statusChangeId, newStatus);
            showToast('success', 'Status atualizado com sucesso!');
            carregarPedidos();
        } catch (error: any) {
            showToast('error', error.response?.data?.message || 'Erro ao mudar status');
        } finally {
            setStatusChangeId(null);
            setNewStatus('');
        }
    };

    // Badge de status
    const getStatusBadge = (status: string) => {
        const cores: Record<string, string> = {
            'PENDENTE': 'bg-yellow-100 text-yellow-800',
            'CONFIRMADO': 'bg-blue-100 text-blue-800',
            'EM_PREPARACAO': 'bg-purple-100 text-purple-800',
            'PRONTO': 'bg-green-100 text-green-800',
            'ENTREGUE': 'bg-emerald-100 text-emerald-800',
            'CANCELADO': 'bg-red-100 text-red-800'
        };
        return cores[status] || 'bg-gray-100 text-gray-800';
    };

    const labels: Record<string, string> = {
        'PENDENTE': '⏳ Pendente',
        'CONFIRMADO': '✓ Confirmado',
        'EM_PREPARACAO': '🔄 Em Preparação',
        'PRONTO': '📦 Pronto',
        'ENTREGUE': '✓✓ Entregue',
        'CANCELADO': '✗ Cancelado'
    };

    return (
        <div className="flex h-screen bg-gray-50">
            {/* SIDEBAR DESKTOP */}
            <div className="hidden lg:flex w-64 bg-slate-900 text-white flex-col">
                <div className="p-6 border-b border-slate-800">
                    <h1 className="brand text-3xl font-bold tracking-tight">AGERP</h1>
                    <p className="text-xs text-slate-400 mt-1">Gestão Empresarial</p>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <Link
                        to="/dashboard"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline hover:no-underline"
                    >
                        📊 Dashboard
                    </Link>
                    <Link
                        to="/clientes"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline hover:no-underline"
                    >
                        👥 Clientes
                    </Link>
                    <Link
                        to="/produtos"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline hover:no-underline"
                    >
                        📦 Produtos
                    </Link>
                    <Link
                        to="/pedidos"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 text-white font-medium no-underline hover:no-underline"
                    >
                        🛒 Pedidos
                    </Link>
                    <Link
                        to="/admin"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline hover:no-underline"
                    >
                        🔧 Admin
                    </Link>
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                            {user?.email?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <div>
                            <p className="text-sm font-medium">{user?.nome || user?.email}</p>
                            <p className="text-xs text-emerald-400">Ativo</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="mt-6 w-full py-3 text-red-400 hover:bg-slate-800 rounded-xl transition"
                    >
                        Sair da conta
                    </button>
                </div>
            </div>

            {/* SIDEBAR MOBILE (Overlay) */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <div className={`fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white z-50 transform transition-transform lg:hidden ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                <div className="p-6 border-b border-slate-800">
                    <div className="flex justify-between items-center">
                        <h1 className="brand text-3xl font-bold tracking-tight">AGERP</h1>
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="text-slate-400 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <Link
                        to="/dashboard"
                        onClick={() => setIsSidebarOpen(false)}
                        className="block px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline hover:no-underline"
                    >
                        📊 Dashboard
                    </Link>
                    <Link
                        to="/clientes"
                        onClick={() => setIsSidebarOpen(false)}
                        className="block px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline hover:no-underline"
                    >
                        👥 Clientes
                    </Link>
                    <Link
                        to="/produtos"
                        onClick={() => setIsSidebarOpen(false)}
                        className="block px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline hover:no-underline"
                    >
                        📦 Produtos
                    </Link>
                    <Link
                        to="/pedidos"
                        onClick={() => setIsSidebarOpen(false)}
                        className="block px-4 py-3 rounded-xl bg-slate-800 text-white font-medium no-underline hover:no-underline"
                    >
                        🛒 Pedidos
                    </Link>
                    <Link
                        to="/admin"
                        onClick={() => setIsSidebarOpen(false)}
                        className="block px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline hover:no-underline"
                    >
                        🔧 Admin
                    </Link>
                </nav>
            </div>

            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 flex flex-col">
                {/* HEADER */}
                <header className="bg-white border-b px-4 lg:px-8 py-5 flex items-center gap-4">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="lg:hidden text-2xl"
                    >
                        ☰
                    </button>
                    <span className="text-3xl">🛒</span>
                    <h1 className="text-2xl font-semibold text-gray-800">Pedidos</h1>
                </header>

                {/* CONTEÚDO */}
                <div className="p-4 lg:p-8 flex-1 overflow-auto">
                    {/* BARRA DE FILTROS */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <input
                            type="text"
                            placeholder="Buscar por ID ou cliente..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="border rounded-lg px-4 py-2"
                        />
                        <select
                            value={filtroStatus}
                            onChange={(e) => setFiltroStatus(e.target.value)}
                            className="border rounded-lg px-4 py-2"
                        >
                            <option value="">Todos os Status</option>
                            <option value="PENDENTE">Pendente</option>
                            <option value="CONFIRMADO">Confirmado</option>
                            <option value="EM_PREPARACAO">Em Preparação</option>
                            <option value="PRONTO">Pronto</option>
                            <option value="ENTREGUE">Entregue</option>
                            <option value="CANCELADO">Cancelado</option>
                        </select>
                        <select
                            value={filtroCliente}
                            onChange={(e) => setFiltroCliente(e.target.value)}
                            className="border rounded-lg px-4 py-2"
                        >
                            <option value="">Todos os Clientes</option>
                            {clientes.map(c => (
                                <option key={c.id} value={c.id}>{c.nomeRazao}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => abrirModal()}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition font-medium"
                        >
                            + Novo Pedido
                        </button>
                    </div>

                    {/* LOADING */}
                    {loading && (
                        <div className="text-center py-12">
                            <p className="text-gray-500">Carregando pedidos...</p>
                        </div>
                    )}

                    {/* EMPTY STATE */}
                    {!loading && pedidosFiltrados.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-gray-500 text-lg">Nenhum pedido encontrado.</p>
                            <button
                                onClick={() => abrirModal()}
                                className="mt-4 text-indigo-600 font-medium hover:underline"
                            >
                                Crie o primeiro pedido →
                            </button>
                        </div>
                    )}

                    {/* TABELA */}
                    {!loading && pedidosFiltrados.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-100 border-b">
                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">ID</th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Cliente</th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Data</th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Itens</th>
                                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pedidosFiltrados.map(pedido => (
                                        <tr key={pedido.id} className="border-b hover:bg-gray-50 transition">
                                            <td className="px-4 py-3 font-medium text-gray-900">#{pedido.id}</td>
                                            <td className="px-4 py-3 text-gray-600">{pedido.nomeCliente}</td>
                                            <td className="px-4 py-3 text-gray-600">{formatarData(pedido.dataPedido)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(pedido.status)}`}>
                                                    {labels[pedido.status] || pedido.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                                {formatarMoeda(pedido.valorTotal)}
                                            </td>
                                            <td className="px-4 py-3 text-center text-gray-600">
                                                {pedido.itens?.length || 0}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => abrirModal(pedido)}
                                                        className="text-blue-600 hover:text-blue-800 text-lg"
                                                        title="Editar"
                                                    >
                                                        ✎
                                                    </button>
                                                    {transicoes[pedido.status]?.length > 0 && (
                                                        <div className="relative group">
                                                            <button
                                                                className="text-yellow-600 hover:text-yellow-800 text-lg"
                                                                title="Mudar status"
                                                            >
                                                                ↻
                                                            </button>
                                                            <div className="hidden group-hover:block absolute right-0 top-full mt-2 bg-white border shadow-lg rounded-lg p-2 z-10">
                                                                {transicoes[pedido.status].map(status => (
                                                                    <button
                                                                        key={status}
                                                                        onClick={() => {
                                                                            abrirMudancaStatus(pedido.id, pedido.status);
                                                                            setNewStatus(status);
                                                                            executarMudancaStatus();
                                                                        }}
                                                                        className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                                                                    >
                                                                        {labels[status] || status}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {pedido.status !== 'ENTREGUE' && pedido.status !== 'CANCELADO' && (
                                                        <button
                                                            onClick={() => confirmarExclusao(pedido.id)}
                                                            className="text-red-600 hover:text-red-800 text-lg"
                                                            title="Cancelar/Deletar"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        {/* CABEÇALHO */}
                        <div className="bg-indigo-600 text-white px-6 py-4 flex justify-between items-center sticky top-0">
                            <h2 className="text-2xl font-bold">
                                {editandoId ? '✎ Editar Pedido' : '+ Novo Pedido'}
                            </h2>
                            <button
                                onClick={fecharModal}
                                className="text-2xl hover:text-gray-200 transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* CONTEÚDO */}
                        <div className="p-6 space-y-4">
                            {/* CLIENTE */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Cliente *
                                </label>
                                <select
                                    value={formData.idCliente}
                                    onChange={(e) => setFormData(prev => ({ ...prev, idCliente: e.target.value }))}
                                    className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                                >
                                    <option value="">Selecione um cliente</option>
                                    {clientes.map(c => (
                                        <option key={c.id} value={c.id}>{c.nomeRazao}</option>
                                    ))}
                                </select>
                            </div>

                            {/* PRODUTOS */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Produtos *
                                    </label>
                                    <button
                                        onClick={adicionarItem}
                                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                    >
                                        + Adicionar
                                    </button>
                                </div>

                                {formData.itens.length === 0 ? (
                                    <p className="text-gray-500 text-sm">Nenhum produto adicionado.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {formData.itens.map((item, index) => (
                                            <div key={index} className="flex gap-3 items-end">
                                                <div className="flex-1">
                                                    <select
                                                        value={item.idProduto}
                                                        onChange={(e) => atualizarItem(index, 'idProduto', e.target.value)}
                                                        className="w-full border rounded-lg px-3 py-2 text-sm"
                                                    >
                                                        <option value="">Selecione...</option>
                                                        {produtos.map(p => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.nome} ({formatarMoeda(p.preco)})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="w-24">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantidade}
                                                        onChange={(e) => atualizarItem(index, 'quantidade', e.target.value)}
                                                        placeholder="Qtd"
                                                        className="w-full border rounded-lg px-3 py-2 text-sm"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => removerItem(index)}
                                                    className="text-red-600 hover:text-red-800 font-bold text-lg"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* OBSERVAÇÕES */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Observações
                                </label>
                                <textarea
                                    value={formData.observacoes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                                    placeholder="Notas adicionais..."
                                    className="w-full border rounded-lg px-4 py-2 h-20 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                                />
                            </div>

                            {/* RESUMO */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-600">Itens</p>
                                        <p className="text-xl font-bold text-gray-900">{formData.itens.length}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-gray-600">Total</p>
                                        <p className="text-xl font-bold text-gray-900">{formatarMoeda(calcularTotal())}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RODAPÉ */}
                        <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t">
                            <button
                                onClick={fecharModal}
                                className="px-6 py-2 border rounded-lg hover:bg-gray-100 transition font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={salvarPedido}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                            >
                                {editandoId ? 'Atualizar' : 'Criar'} Pedido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* POPOVER DE CONFIRMAÇÃO DE EXCLUSÃO */}
            {deleteConfirmId !== null && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-2xl p-6 max-w-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-3">Cancelar Pedido?</h3>
                        <p className="text-gray-600 mb-6">
                            Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-6 py-2 border rounded-lg hover:bg-gray-100 transition font-medium"
                            >
                                Não
                            </button>
                            <button
                                onClick={executarExclusao}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                            >
                                Sim, Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TOASTS */}
            <div className="fixed bottom-4 right-4 space-y-2 z-40">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`px-4 py-3 rounded-lg text-white font-medium shadow-lg animation-fade-in-out ${
                            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
                        }`}
                    >
                        {toast.type === 'success' ? '✓' : '✕'} {toast.message}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Pedidos;
