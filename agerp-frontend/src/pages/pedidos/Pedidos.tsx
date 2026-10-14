import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { pedidoService } from '../../services/pedidoService';
import type { 
    PedidoResponse, 
    ItemPedidoRequest, 
    PedidoCreateRequest, 
    PedidoUpdateRequest,
    PrevisaoEntregaResponse 
} from '../../services/pedidoService';
import { produtoService } from '../../services/produtoService';
import { clienteService } from '../../services/clienteService';
import { enderecoService, type Endereco } from '../../services/enderecoService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getHttpErrorMessage } from '../../utils/httpError';

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
    const [salvando, setSalvando] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Modal de Criação / Edição
    const [modalOpen, setModalOpen] = useState(false);
    const [editandoId, setEditandoId] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        idCliente: '',
        idEndereco: '',
        itens: [] as Array<{ idProduto: string; quantidade: string }>,
        observacoes: ''
    });

    // Endereços do cliente selecionado no modal
    const [enderecosCliente, setEnderecosCliente] = useState<Endereco[]>([]);
    const [loadingEnderecos, setLoadingEnderecos] = useState(false);
    const [erroEnderecos, setErroEnderecos] = useState<string | null>(null);

    // Modal de Detalhes e IA
    const [detalhesOpen, setDetalhesOpen] = useState(false);
    const [pedidoDetalhe, setPedidoDetalhe] = useState<PedidoResponse | null>(null);
    const [previsaoIa, setPrevisaoIa] = useState<PrevisaoEntregaResponse | null>(null);
    const [loadingPrevisao, setLoadingPrevisao] = useState(false);

    // Exclusão / Cancelamento
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [statusChangeId, setStatusChangeId] = useState<number | null>(null);

    // Toasts
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((type: 'success' | 'error', message: string) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    // Carregar dados
    const carregarPedidos = useCallback(async () => {
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
    }, [showToast]);

    const carregarProdutos = useCallback(async () => {
        try {
            const response = await produtoService.listar();
            setProdutos(response.data);
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
        }
    }, []);

    const carregarClientes = useCallback(async () => {
        try {
            const response = await clienteService.listar();
            setClientes(response.data);
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
        }
    }, []);

    useEffect(() => {
        carregarPedidos();
        carregarProdutos();
        carregarClientes();
    }, [carregarClientes, carregarPedidos, carregarProdutos]);

    // Filtrar pedidos
    const pedidosFiltrados = pedidos.filter(p => {
        const matchBusca = p.id.toString().includes(busca) || 
                          (p.nomeCliente && p.nomeCliente.toLowerCase().includes(busca.toLowerCase()));
        const matchStatus = filtroStatus === '' || p.status === filtroStatus;
        const matchCliente = filtroCliente === '' || p.idCliente.toString() === filtroCliente;
        return matchBusca && matchStatus && matchCliente;
    });

    // Adicionar item ao pedido
    const adicionarItem = () => {
        setFormData(prev => ({
            ...prev,
            itens: [...prev.itens, { idProduto: '', quantidade: '1' }]
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

    // Calcular total no frontend para visualização em tempo real
    const calcularTotalVisual = (): number => {
        return formData.itens.reduce((total, item) => {
            const produto = produtos.find(p => p.id.toString() === item.idProduto);
            const quantidade = parseInt(item.quantidade) || 0;
            return total + (produto && produto.preco ? produto.preco * quantidade : 0);
        }, 0);
    };

    // Formatar exibição amigável do endereço
    const formatarEnderecoAmigavel = (end: Endereco): string => {
        const partes: string[] = [];
        if (end.logradouro) partes.push(end.logradouro);
        if (end.numero) partes.push(`nº ${end.numero}`);
        if (end.bairro) partes.push(end.bairro);
        if (end.cidade && end.estado) partes.push(`${end.cidade}/${end.estado}`);
        else if (end.cidade) partes.push(end.cidade);
        if (end.cep) partes.push(`CEP ${end.cep}`);
        return partes.join(', ') || `Endereço #${end.id}`;
    };

    // Carregar endereços de um cliente
    const carregarEnderecosDoCliente = async (clienteId: number): Promise<Endereco[]> => {
        try {
            setLoadingEnderecos(true);
            setErroEnderecos(null);
            const resp = await enderecoService.listarPorCliente(clienteId);
            const lista = resp.data || [];
            setEnderecosCliente(lista);
            return lista;
        } catch (error) {
            console.error('Erro ao carregar endereços do cliente:', error);
            setErroEnderecos('Não foi possível carregar os endereços do cliente');
            setEnderecosCliente([]);
            return [];
        } finally {
            setLoadingEnderecos(false);
        }
    };

    // Handler de alteração do cliente no formulário
    const handleClienteChange = async (novoClienteId: string) => {
        // Ao trocar de cliente, atualize a lista de endereços e limpe a seleção anterior
        setFormData(prev => ({
            ...prev,
            idCliente: novoClienteId,
            idEndereco: ''
        }));
        setEnderecosCliente([]);
        setErroEnderecos(null);

        if (novoClienteId) {
            const idNum = parseInt(novoClienteId);
            if (!isNaN(idNum)) {
                await carregarEnderecosDoCliente(idNum);
            }
        }
    };

    // Abrir modal de criação ou edição
    const abrirModal = async (pedido?: PedidoResponse) => {
        setErroEnderecos(null);
        if (pedido) {
            if (pedido.status !== 'PENDENTE') {
                showToast('error', 'Apenas pedidos PENDENTES podem ser editados');
                return;
            }
            setEditandoId(pedido.id);
            setFormData({
                idCliente: pedido.idCliente.toString(),
                idEndereco: pedido.idEndereco ? pedido.idEndereco.toString() : '',
                itens: pedido.itens.map(item => ({
                    idProduto: item.idProduto.toString(),
                    quantidade: item.quantidade.toString()
                })),
                observacoes: pedido.observacoes || ''
            });
            setModalOpen(true);
            // Carregar os endereços do cliente do pedido sendo editado
            await carregarEnderecosDoCliente(pedido.idCliente);
        } else {
            setEditandoId(null);
            setEnderecosCliente([]);
            setFormData({
                idCliente: '',
                idEndereco: '',
                itens: [{ idProduto: '', quantidade: '1' }],
                observacoes: ''
            });
            setModalOpen(true);
        }
    };

    // Fechar modal
    const fecharModal = () => {
        setModalOpen(false);
        setEditandoId(null);
        setSalvando(false);
        setEnderecosCliente([]);
        setErroEnderecos(null);
        setLoadingEnderecos(false);
    };

    // Abrir detalhes do pedido com IA
    const abrirDetalhes = async (pedido: PedidoResponse) => {
        setPedidoDetalhe(pedido);
        setDetalhesOpen(true);
        setPrevisaoIa(null);
        carregarPrevisaoIa(pedido.id);
    };

    const carregarPrevisaoIa = async (idPedido: number) => {
        try {
            setLoadingPrevisao(true);
            const resp = await pedidoService.obterPrevisaoEntrega(idPedido);
            setPrevisaoIa(resp.data);
        } catch (error) {
            console.warn('Não foi possível carregar previsão de IA:', error);
        } finally {
            setLoadingPrevisao(false);
        }
    };

    // Validar formulário
    const validarFormulario = (): boolean => {
        if (!formData.idCliente) {
            showToast('error', 'Selecione um cliente');
            return false;
        }

        // Validação das regras de negócio do endereço
        if (formData.idEndereco) {
            const endId = parseInt(formData.idEndereco);
            const enderecoValido = enderecosCliente.some(e => e.id === endId);
            if (!enderecoValido && enderecosCliente.length > 0) {
                showToast('error', 'O endereço selecionado não pertence ao cliente informado');
                return false;
            }
        }

        if (formData.itens.length === 0) {
            showToast('error', 'Adicione pelo menos um produto');
            return false;
        }
        const idsProdutos = new Set<string>();
        for (let i = 0; i < formData.itens.length; i++) {
            const item = formData.itens[i];
            if (!item.idProduto) {
                showToast('error', `Selecione um produto no item ${i + 1}`);
                return false;
            }
            if (idsProdutos.has(item.idProduto)) {
                showToast('error', `Produto duplicado no item ${i + 1}`);
                return false;
            }
            idsProdutos.add(item.idProduto);

            const quantidade = parseInt(item.quantidade);
            if (!item.quantidade || isNaN(quantidade) || quantidade <= 0) {
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
            setSalvando(true);
            const itens: ItemPedidoRequest[] = formData.itens.map(item => ({
                idProduto: parseInt(item.idProduto),
                quantidade: parseInt(item.quantidade)
            }));

            const payload = {
                idCliente: parseInt(formData.idCliente),
                idEndereco: formData.idEndereco ? parseInt(formData.idEndereco) : undefined,
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
        } catch (error: unknown) {
            showToast('error', getHttpErrorMessage(error, 'Erro ao salvar pedido'));
        } finally {
            setSalvando(false);
        }
    };

    // Confirmar exclusão
    const confirmarExclusao = (id: number) => setDeleteConfirmId(id);

    // Executar cancelamento/exclusão
    const executarExclusao = async () => {
        if (!deleteConfirmId) return;
        try {
            await pedidoService.deletar(deleteConfirmId);
            showToast('success', 'Pedido cancelado/excluído com sucesso!');
            carregarPedidos();
        } catch (error: unknown) {
            showToast('error', getHttpErrorMessage(error, 'Erro ao cancelar pedido'));
        } finally {
            setDeleteConfirmId(null);
        }
    };

    // Mudar status
    const transicoes: Record<string, string[]> = {
        'PENDENTE': ['CONFIRMADO', 'CANCELADO'],
        'CONFIRMADO': ['EM_PREPARACAO', 'CANCELADO'],
        'EM_PREPARACAO': ['PRONTO', 'CANCELADO'],
        'PRONTO': ['ENTREGUE', 'CANCELADO'],
        'ENTREGUE': [],
        'CANCELADO': []
    };

    const executarMudancaStatus = async (id: number, statusAlvo: string) => {
        try {
            await pedidoService.mudarStatus(id, statusAlvo);
            showToast('success', `Status atualizado para ${labels[statusAlvo] || statusAlvo}!`);
            carregarPedidos();
            if (pedidoDetalhe && pedidoDetalhe.id === id) {
                setPedidoDetalhe(prev => prev ? { ...prev, status: statusAlvo } : null);
            }
        } catch (error: unknown) {
            showToast('error', getHttpErrorMessage(error, 'Erro ao mudar status'));
        } finally {
            setStatusChangeId(null);
        }
    };

    // Badge de status
    const getStatusBadge = (status: string) => {
        const cores: Record<string, string> = {
            'PENDENTE': 'bg-amber-100 text-amber-800 border-amber-200',
            'CONFIRMADO': 'bg-blue-100 text-blue-800 border-blue-200',
            'EM_PREPARACAO': 'bg-purple-100 text-purple-800 border-purple-200',
            'PRONTO': 'bg-cyan-100 text-cyan-800 border-cyan-200',
            'ENTREGUE': 'bg-emerald-100 text-emerald-800 border-emerald-200',
            'CANCELADO': 'bg-rose-100 text-rose-800 border-rose-200'
        };
        return cores[status] || 'bg-gray-100 text-gray-800 border-gray-200';
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
        <div className="h-screen bg-gray-50 flex overflow-hidden">
            {/* SIDEBAR DESKTOP */}
            <div className="hidden lg:flex w-64 bg-slate-900 text-white flex-col h-screen">
                <div className="p-6 border-b border-slate-800">
                    <h1 className="brand text-3xl font-bold tracking-tight">AGERP</h1>
                    <p className="text-xs text-slate-400 mt-1">Gestão Empresarial</p>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline hover:no-underline">📊 Dashboard</Link>
                    <Link to="/clientes" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline hover:no-underline">👥 Clientes</Link>
                    <Link to="/produtos" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline hover:no-underline">📦 Produtos</Link>
                    <Link to="/pedidos" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 text-white font-medium no-underline hover:no-underline">📋 Pedidos</Link>
                </nav>

                <div className="p-4 border-t border-slate-800 mt-auto">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                            {user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium break-words leading-tight mb-1">
                                {user?.nome || user?.email}
                            </p>
                            <p className="text-xs text-emerald-400">Online</p>
                        </div>
                    </div>
                    <button 
                        onClick={logout} 
                        className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg mt-1 w-full py-2 text-red-400 hover:bg-slate-800 rounded-xl"
                    >
                        Sair da conta
                    </button>
                </div>
            </div>

            {/* SIDEBAR MOBILE */}
            <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 lg:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                    <div>
                        <h1 className="brand text-3xl font-bold tracking-tight">AGERP</h1>
                        <p className="text-xs text-slate-400 mt-1">Gestão Empresarial</p>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-3xl text-white">✕</button>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <Link to="/dashboard" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline">📊 Dashboard</Link>
                    <Link to="/clientes" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline">👥 Clientes</Link>
                    <Link to="/produtos" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline">📦 Produtos</Link>
                    <Link to="/pedidos" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 text-white font-medium no-underline">📋 Pedidos</Link>
                </nav>

                <div className="p-4 border-t border-slate-800 mt-auto">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                            {user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium break-words leading-tight">
                                {user?.nome || user?.email}
                            </p>
                            <p className="text-xs text-emerald-400">Online</p>
                        </div>
                    </div>
                    <button onClick={logout} className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg mt-6 w-full py-3 text-red-400 hover:bg-slate-800 rounded-xl">
                        Sair da conta
                    </button>
                </div>
            </div>

            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
            )}

            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* HEADER */}
                <header className="bg-white border-b px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-3xl text-gray-700">☰</button>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">📋 Pedidos</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <input
                            type="text"
                            placeholder="Buscar por ID ou cliente..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-80 px-5 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:border-indigo-500 text-sm"
                        />
                        <button
                            onClick={() => abrirModal()}
                            className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-medium flex items-center gap-2"
                        >
                            + Novo Pedido
                        </button>
                    </div>
                </header>

                {/* FILTROS E CORPO */}
                <div className="p-6 md:p-8 flex-1 overflow-auto">
                    {/* BARRA DE FILTROS RÁPIDOS */}
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                        <select
                            value={filtroStatus}
                            onChange={(e) => setFiltroStatus(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">Todos os Status</option>
                            <option value="PENDENTE">⏳ Pendente</option>
                            <option value="CONFIRMADO">✓ Confirmado</option>
                            <option value="EM_PREPARACAO">🔄 Em Preparação</option>
                            <option value="PRONTO">📦 Pronto</option>
                            <option value="ENTREGUE">✓✓ Entregue</option>
                            <option value="CANCELADO">✗ Cancelado</option>
                        </select>

                        <select
                            value={filtroCliente}
                            onChange={(e) => setFiltroCliente(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">Todos os Clientes</option>
                            {clientes.map(c => (
                                <option key={c.id} value={c.id}>{c.nomeRazao}</option>
                            ))}
                        </select>

                        <div className="text-xs text-gray-500 ml-auto font-medium">
                            Total exibido: {pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'pedido' : 'pedidos'}
                        </div>
                    </div>

                    {/* LOADING */}
                    {loading && (
                        <div className="text-center py-16 text-gray-500 font-medium">
                            Carregando pedidos...
                        </div>
                    )}

                    {/* EMPTY STATE */}
                    {!loading && pedidosFiltrados.length === 0 && (
                        <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100 max-w-lg mx-auto mt-8">
                            <span className="text-5xl block mb-4">📋</span>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">Nenhum pedido encontrado</h3>
                            <p className="text-gray-500 text-sm mb-6">
                                {busca || filtroStatus || filtroCliente
                                    ? 'Tente ajustar os filtros para encontrar o que procura.'
                                    : 'Comece cadastrando o primeiro pedido da sua empresa.'}
                            </p>
                            <button
                                onClick={() => abrirModal()}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition"
                            >
                                + Criar Pedido
                            </button>
                        </div>
                    )}

                    {/* TABELA DE PEDIDOS */}
                    {!loading && pedidosFiltrados.length > 0 && (
                        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                                        <tr>
                                            <th className="px-6 py-4">ID</th>
                                            <th className="px-6 py-4">Cliente</th>
                                            <th className="px-6 py-4">Data</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-center">Itens</th>
                                            <th className="px-6 py-4 text-right">Valor Total</th>
                                            <th className="px-6 py-4 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                                        {pedidosFiltrados.map((pedido) => (
                                            <tr key={pedido.id} className="hover:bg-gray-50/80 transition">
                                                <td className="px-6 py-4 font-bold text-indigo-600">
                                                    #{pedido.id}
                                                </td>
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    <div>{pedido.nomeCliente || `Cliente #${pedido.idCliente}`}</div>
                                                    {pedido.enderecoResumo && (
                                                        <div className="text-xs text-gray-400 font-normal truncate max-w-xs flex items-center gap-1 mt-0.5" title={pedido.enderecoResumo}>
                                                            <span>📍</span>
                                                            <span className="truncate">{pedido.enderecoResumo}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    {formatDate(pedido.dataPedido)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(pedido.status)}`}>
                                                        {labels[pedido.status] || pedido.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center font-medium">
                                                    {pedido.itens?.length || 0}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-gray-900">
                                                    {formatCurrency(pedido.valorTotal)}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {/* Botão Ver Detalhes + IA */}
                                                        <button
                                                            onClick={() => abrirDetalhes(pedido)}
                                                            className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                                            title="Ver detalhes e Previsão IA"
                                                        >
                                                            👁
                                                        </button>

                                                        {/* Editar (somente PENDENTE) */}
                                                        {pedido.status === 'PENDENTE' && (
                                                            <button
                                                                onClick={() => abrirModal(pedido)}
                                                                className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                                title="Editar pedido"
                                                            >
                                                                ✎
                                                            </button>
                                                        )}

                                                        {/* Transições de Status */}
                                                        {transicoes[pedido.status]?.length > 0 && (
                                                            <div className="relative">
                                                                <button
                                                                    onClick={() => setStatusChangeId(statusChangeId === pedido.id ? null : pedido.id)}
                                                                    className="p-1.5 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                                                    title="Mudar status"
                                                                >
                                                                    ↻
                                                                </button>
                                                                {statusChangeId === pedido.id && (
                                                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20 text-left">
                                                                        <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">
                                                                            Avançar para:
                                                                        </div>
                                                                        {transicoes[pedido.status].map((proxStatus) => (
                                                                            <button
                                                                                key={proxStatus}
                                                                                onClick={() => executarMudancaStatus(pedido.id, proxStatus)}
                                                                                className="block w-full text-left px-4 py-2 text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 transition"
                                                                            >
                                                                                {labels[proxStatus] || proxStatus}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Cancelar */}
                                                        {pedido.status !== 'ENTREGUE' && pedido.status !== 'CANCELADO' && (
                                                            <button
                                                                onClick={() => confirmarExclusao(pedido.id)}
                                                                className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                                title="Cancelar pedido"
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
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DETALHES DO PEDIDO + IA */}
            {detalhesOpen && pedidoDetalhe && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    Pedido #{pedidoDetalhe.id}
                                    <span className={`text-xs px-2.5 py-0.5 rounded-full border ${getStatusBadge(pedidoDetalhe.status)}`}>
                                        {labels[pedidoDetalhe.status] || pedidoDetalhe.status}
                                    </span>
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Emitido em {formatDate(pedidoDetalhe.dataPedido)}
                                </p>
                            </div>
                            <button
                                onClick={() => setDetalhesOpen(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* DADOS BÁSICOS */}
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl text-sm">
                                <div>
                                    <span className="text-gray-500 text-xs block">Cliente</span>
                                    <span className="font-semibold text-gray-900">{pedidoDetalhe.nomeCliente}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 text-xs block">Responsável</span>
                                    <span className="font-semibold text-gray-900">{pedidoDetalhe.nomeUsuario || 'Sistema'}</span>
                                </div>
                                <div className="col-span-2 pt-2 border-t border-gray-200/60">
                                    <span className="text-gray-500 text-xs block">Endereço de Entrega</span>
                                    <span className="font-semibold text-gray-900 flex items-center gap-1.5 mt-0.5">
                                        <span>📍</span>
                                        {pedidoDetalhe.enderecoResumo || (
                                            <span className="text-gray-400 font-normal italic">Nenhum endereço vinculado (Retirada ou Padrão)</span>
                                        )}
                                    </span>
                                </div>
                                {pedidoDetalhe.observacoes && (
                                    <div className="col-span-2 pt-2 border-t border-gray-200/60">
                                        <span className="text-gray-500 text-xs block">Observações</span>
                                        <span className="text-gray-700 text-xs mt-0.5 block whitespace-pre-wrap">
                                            {pedidoDetalhe.observacoes}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* PAINEL DE INTELIGÊNCIA ARTIFICIAL - PREVISÃO DE ENTREGA */}
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                                        <span>⚡</span> Previsão de Entrega Inteligente (Machine Learning)
                                    </h3>
                                    <button
                                        onClick={() => carregarPrevisaoIa(pedidoDetalhe.id)}
                                        disabled={loadingPrevisao}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                                    >
                                        {loadingPrevisao ? 'Calculando...' : 'Recalcular'}
                                    </button>
                                </div>

                                {loadingPrevisao ? (
                                    <div className="text-center py-4 text-xs text-indigo-700 animate-pulse">
                                        Consultando modelo preditivo Random Forest...
                                    </div>
                                ) : previsaoIa ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            <div className="bg-white p-3 rounded-xl shadow-xs border border-indigo-50">
                                                <span className="text-xs text-gray-500 block">Prazo Mínimo</span>
                                                <span className="text-lg font-bold text-indigo-600">{previsaoIa.prazoMinimoDias} dias</span>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl shadow-xs border border-indigo-50">
                                                <span className="text-xs text-gray-500 block">Estimativa Central</span>
                                                <span className="text-lg font-bold text-purple-600">{previsaoIa.estimativaCentralDias} dias</span>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl shadow-xs border border-indigo-50">
                                                <span className="text-xs text-gray-500 block">Prazo Máximo</span>
                                                <span className="text-lg font-bold text-indigo-900">{previsaoIa.prazoMaximoDias} dias</span>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-600 flex justify-between items-center px-1">
                                            <span>Rota: <strong>{previsaoIa.cidadeOrigem}/{previsaoIa.estadoOrigem} → {previsaoIa.cidadeDestino}/{previsaoIa.estadoDestino}</strong></span>
                                            <span className="text-indigo-700 font-medium">{previsaoIa.modeloVersao}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500">
                                        Nenhuma previsão gerada ainda para este pedido.
                                    </p>
                                )}
                            </div>

                            {/* LISTA DE ITENS */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 mb-3">Itens do Pedido</h4>
                                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-100">
                                            <tr>
                                                <th className="px-4 py-3">Produto</th>
                                                <th className="px-4 py-3 text-center">Qtd</th>
                                                <th className="px-4 py-3 text-right">Preço Unitário</th>
                                                <th className="px-4 py-3 text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {pedidoDetalhe.itens?.map((item) => (
                                                <tr key={item.id}>
                                                    <td className="px-4 py-3 font-medium text-gray-900">{item.nomeProduto}</td>
                                                    <td className="px-4 py-3 text-center font-semibold">{item.quantidade}</td>
                                                    <td className="px-4 py-3 text-right">{formatCurrency(item.precoUnitario)}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(item.subtotal)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* TOTAL */}
                            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
                                <span className="font-semibold text-gray-700">Total do Pedido</span>
                                <span className="text-2xl font-bold text-indigo-600">
                                    {formatCurrency(pedidoDetalhe.valorTotal)}
                                </span>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setDetalhesOpen(false)}
                                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CRIAÇÃO / EDIÇÃO */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editandoId ? `Editar Pedido #${editandoId}` : 'Novo Pedido'}
                            </h2>
                            <button
                                onClick={fecharModal}
                                className="text-gray-400 hover:text-gray-600 text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* SELEÇÃO DO CLIENTE */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                                    Cliente *
                                </label>
                                <select
                                    value={formData.idCliente}
                                    onChange={(e) => handleClienteChange(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Selecione um cliente...</option>
                                    {clientes.map(c => (
                                        <option key={c.id} value={c.id}>{c.nomeRazao}</option>
                                    ))}
                                </select>
                            </div>

                            {/* SELEÇÃO DO ENDEREÇO DE ENTREGA */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Endereço de Entrega
                                    </label>
                                    {loadingEnderecos && (
                                        <span className="text-xs text-indigo-600 flex items-center gap-1">
                                            <span className="inline-block animate-spin">↻</span> Carregando endereços...
                                        </span>
                                    )}
                                </div>

                                <select
                                    value={formData.idEndereco}
                                    onChange={(e) => setFormData(prev => ({ ...prev, idEndereco: e.target.value }))}
                                    disabled={!formData.idCliente || loadingEnderecos}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                >
                                    {!formData.idCliente ? (
                                        <option value="">Selecione um cliente primeiro...</option>
                                    ) : loadingEnderecos ? (
                                        <option value="">Carregando endereços cadastrados...</option>
                                    ) : enderecosCliente.length === 0 ? (
                                        <option value="">Nenhum endereço cadastrado para este cliente</option>
                                    ) : (
                                        <>
                                            <option value="">Sem endereço específico (Padrão/Retirada)</option>
                                            {enderecosCliente.map(end => (
                                                <option key={end.id} value={end.id}>
                                                    {formatarEnderecoAmigavel(end)}
                                                </option>
                                            ))}
                                        </>
                                    )}
                                </select>

                                {/* Mensagens de auxílio e estado */}
                                {erroEnderecos && (
                                    <div className="mt-2 text-xs text-rose-600 flex items-center gap-1">
                                        <span>⚠️</span> {erroEnderecos}
                                        <button
                                            type="button"
                                            onClick={() => formData.idCliente && carregarEnderecosDoCliente(parseInt(formData.idCliente))}
                                            className="underline hover:text-rose-800 ml-1 font-semibold"
                                        >
                                            Tentar novamente
                                        </button>
                                    </div>
                                )}

                                {formData.idCliente && !loadingEnderecos && !erroEnderecos && enderecosCliente.length === 0 && (
                                    <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                                        <span>ℹ️</span> Este cliente ainda não possui endereços cadastrados. Você pode cadastrar na aba <strong>Clientes</strong>.
                                    </p>
                                )}

                                {formData.idEndereco && (
                                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                                        📍 <strong>Entrega selecionada:</strong> {
                                            enderecosCliente.find(e => e.id?.toString() === formData.idEndereco)
                                                ? formatarEnderecoAmigavel(enderecosCliente.find(e => e.id?.toString() === formData.idEndereco)!)
                                                : `Endereço #${formData.idEndereco}`
                                        }
                                    </div>
                                )}
                            </div>

                            {/* ITENS DO PEDIDO */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Produtos e Quantidades *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={adicionarItem}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                                    >
                                        + Adicionar Produto
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {formData.itens.map((item, index) => (
                                        <div key={index} className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                            <div className="flex-1">
                                                <select
                                                    value={item.idProduto}
                                                    onChange={(e) => atualizarItem(index, 'idProduto', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                >
                                                    <option value="">Selecione um produto...</option>
                                                    {produtos.filter(p => p.ativo).map(p => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.nome} — {formatCurrency(p.preco)}
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
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    placeholder="Qtd"
                                                />
                                            </div>
                                            {formData.itens.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removerItem(index)}
                                                    className="text-gray-400 hover:text-red-600 px-2 py-1 text-lg font-bold"
                                                    title="Remover produto"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* OBSERVAÇÕES */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                                    Observações (Opcional)
                                </label>
                                <textarea
                                    rows={2}
                                    value={formData.observacoes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                                    placeholder="Instruções de entrega, referências, etc."
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {/* TOTAL ESTIMADO */}
                            <div className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center text-sm">
                                <span className="text-gray-600">Total Previsto:</span>
                                <span className="text-xl font-bold text-gray-900">
                                    {formatCurrency(calcularTotalVisual())}
                                </span>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50 rounded-b-3xl">
                            <button
                                type="button"
                                onClick={fecharModal}
                                className="px-5 py-2.5 text-gray-600 hover:text-gray-800 text-sm font-medium transition"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={salvarPedido}
                                disabled={salvando}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                            >
                                {salvando ? 'Salvando...' : editandoId ? 'Atualizar Pedido' : 'Criar Pedido'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMAÇÃO DE CANCELAMENTO */}
            {deleteConfirmId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
                        <span className="text-4xl block mb-3">⚠️</span>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Cancelar Pedido?</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            Tem certeza que deseja cancelar o pedido #{deleteConfirmId}? Se o estoque já foi baixado, ele será estornado automaticamente.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={executarExclusao}
                                className="px-5 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold transition"
                            >
                                Sim, Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TOASTS */}
            <div className="fixed bottom-6 right-6 space-y-2 z-50">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`px-5 py-3 rounded-2xl text-sm font-medium shadow-xl flex items-center gap-2 text-white ${
                            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                    >
                        <span>{toast.type === 'success' ? '✓' : '✕'}</span>
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Pedidos;
