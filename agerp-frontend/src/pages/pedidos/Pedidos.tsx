import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';

interface Produto {
    id: number;
    nome: string;
    preco: number;
    ativo: boolean;
    quantidadeAtual?: number | null;
    unidadeMedida?: string | null;
}

const formatarEstoqueProduto = (produto: Produto): string => {
    if (produto.quantidadeAtual == null) return 'Estoque: não informado';
    const unidade = produto.unidadeMedida?.trim();
    return `Estoque: ${produto.quantidadeAtual}${unidade ? ` ${unidade}` : ''}`;
};

const rotuloProduto = (produto: Produto): string =>
    `Cód. #${produto.id} · ${produto.nome} — ${formatCurrency(produto.preco)} · ${formatarEstoqueProduto(produto)}`;

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
    const isMobileViewport = useIsMobileViewport();
    const { user } = useAuth();
    const podeCancelar = (user?.nivelAutoridade ?? 0) >= 60 && user?.paginas?.includes('PEDIDOS');

    const [pedidos, setPedidos] = useState<PedidoResponse[]>([]);
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [loadingProdutos, setLoadingProdutos] = useState(false);
    const [erroProdutos, setErroProdutos] = useState(false);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState<string>('');
    const [filtroCliente, setFiltroCliente] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [sort, setSort] = useState<{ key: 'id' | 'nomeCliente' | 'dataPedido' | 'status' | 'valorTotal'; direction: 'asc' | 'desc' }>({ key: 'dataPedido', direction: 'desc' });

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
    const carregarPedidos = useCallback(async (refresh = false) => {
        try {
            setLoading(true);
            const response = await pedidoService.listar(refresh);
            setPedidos(response.data);
            if (refresh) showToast('success', 'Pedidos atualizados com sucesso.');
        } catch (error) {
            console.error('Erro ao carregar pedidos:', error);
            showToast('error', 'Erro ao carregar lista de pedidos');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const carregarProdutos = useCallback(async (refresh = false) => {
        setLoadingProdutos(true);
        setErroProdutos(false);
        try {
            const response = await produtoService.listar(refresh);
            setProdutos(response.data);
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
            setProdutos([]);
            setErroProdutos(true);
        } finally {
            setLoadingProdutos(false);
        }
    }, []);

    const carregarClientes = useCallback(async (refresh = false) => {
        try {
            const response = await clienteService.listar(refresh);
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

    const pedidosFiltrados = useMemo(() => {
        const termo = busca.trim().toLocaleLowerCase('pt-BR');
        const filtrados = pedidos.filter(p => {
        const matchBusca = !termo || [p.id, p.nomeCliente, p.nomeUsuario, p.status, p.dataPedido,
            ...p.itens.map(item => item.nomeProduto)]
            .some(valor => String(valor ?? '').toLocaleLowerCase('pt-BR').includes(termo));
        const matchStatus = filtroStatus === '' || p.status === filtroStatus;
        const matchCliente = filtroCliente === '' || p.idCliente.toString() === filtroCliente;
        return matchBusca && matchStatus && matchCliente;
        });
        return [...filtrados].sort((a, b) => {
            const av = a[sort.key] ?? '';
            const bv = b[sort.key] ?? '';
            const resultado = typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : sort.key === 'dataPedido'
                    ? new Date(String(av)).getTime() - new Date(String(bv)).getTime()
                    : String(av).localeCompare(String(bv), 'pt-BR', { numeric: true, sensitivity: 'base' });
            return sort.direction === 'asc' ? resultado : -resultado;
        });
    }, [busca, filtroCliente, filtroStatus, pedidos, sort]);

    const ordenar = (key: typeof sort.key) => setSort(atual => ({
        key,
        direction: atual.key === key && atual.direction === 'asc' ? 'desc' : 'asc'
    }));
    const indicador = (key: typeof sort.key) => sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : '';

    const atualizarTudo = async () => {
        await Promise.all([carregarPedidos(true), carregarProdutos(true), carregarClientes(true)]);
    };

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
        // Uma única consulta de produtos com estoque ao abrir o seletor.
        void carregarProdutos(true);
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
            await pedidoService.cancelar(deleteConfirmId);
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

    const campoBusca = (
        <input
            type="text"
            placeholder="Buscar por ID ou cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar pedidos"
            className={isMobileViewport
                ? 'mb-3 block w-full min-w-0 rounded-2xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none'
                : 'min-w-0 w-72 rounded-2xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none'}
        />
    );

    return (
        <div className="h-full min-w-0 bg-app-background flex overflow-hidden">
            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* HEADER */}
                <header className="bg-white border-b px-3 sm:px-6 py-3 sm:py-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="hidden min-w-0 items-center gap-4 sm:flex">
                        <h1 className="flex items-center gap-3 text-xl font-bold text-gray-900 sm:text-3xl">📋 Pedidos</h1>
                    </div>

                    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:gap-4">
                        {!isMobileViewport && campoBusca}
                        <button onClick={() => void atualizarTudo()} disabled={loading} className="min-h-11 flex-1 whitespace-nowrap rounded-2xl border border-gray-300 px-3 py-3 font-medium hover:bg-gray-50 disabled:opacity-50 sm:flex-none sm:px-4">{loading ? 'Atualizando...' : '↻ Atualizar'}</button>
                        <button
                            onClick={() => abrirModal()}
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-indigo-600 px-3 py-3 font-medium text-white transition-all duration-300 ease-in-out hover:scale-105 hover:bg-indigo-700 hover:shadow-lg sm:flex-none sm:px-6"
                        >
                            + Novo Pedido
                        </button>
                    </div>
                </header>

                {/* FILTROS E CORPO */}
                <div data-testid="pedidos-scroll" className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 md:p-8">
                    {isMobileViewport && campoBusca}
                    {/* BARRA DE FILTROS RÁPIDOS */}
                    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-4">
                        <select
                            value={filtroStatus}
                            onChange={(e) => setFiltroStatus(e.target.value)}
                            aria-label="Filtrar pedidos por status"
                            className="min-h-11 min-w-0 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                            aria-label="Filtrar pedidos por cliente"
                            className="min-h-11 min-w-0 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">Todos os Clientes</option>
                            {clientes.map(c => (
                                <option key={c.id} value={c.id}>{c.nomeRazao}</option>
                            ))}
                        </select>

                        <div className="text-xs font-medium text-gray-500 sm:col-span-2 lg:ml-auto">
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
                        <div className="mx-auto mt-8 max-w-lg rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-sm sm:p-12">
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
                        <>
                            <div className="mb-3 flex items-center gap-2 md:hidden">
                                <label htmlFor="ordenacao-pedidos-mobile" className="shrink-0 text-sm font-medium text-gray-600">Ordenar:</label>
                                <select id="ordenacao-pedidos-mobile" value={sort.key} onChange={(event) => setSort(atual => ({ ...atual, key: event.target.value as typeof sort.key }))} className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm">
                                    <option value="dataPedido">Data</option><option value="id">ID</option><option value="nomeCliente">Cliente</option><option value="status">Status</option><option value="valorTotal">Valor total</option>
                                </select>
                                <button type="button" onClick={() => setSort(atual => ({ ...atual, direction: atual.direction === 'asc' ? 'desc' : 'asc' }))} className="min-h-11 min-w-11 rounded-xl border border-gray-300 bg-white px-3" aria-label={`Ordem ${sort.direction === 'asc' ? 'crescente' : 'decrescente'}; alternar direção`}>{sort.direction === 'asc' ? '↑' : '↓'}</button>
                            </div>
                            <div className="grid gap-3 md:hidden" aria-label="Lista de pedidos">
                                {pedidosFiltrados.map((pedido) => (
                                    <article key={pedido.id} className="agerp-mobile-card rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                                        <div className="flex min-w-0 items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-bold text-indigo-600">Pedido #{pedido.id}</p>
                                                <h2 className="mt-1 break-words font-semibold text-gray-900">{pedido.nomeCliente || `Cliente #${pedido.idCliente}`}</h2>
                                            </div>
                                            <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadge(pedido.status)}`}>{labels[pedido.status] || pedido.status}</span>
                                        </div>
                                        {pedido.enderecoResumo && <p className="mt-2 break-words text-xs text-gray-500">📍 {pedido.enderecoResumo}</p>}
                                        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                            <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Data</dt><dd className="mt-0.5 text-gray-800">{formatDate(pedido.dataPedido)}</dd></div>
                                            <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Itens</dt><dd className="mt-0.5 font-semibold text-gray-800">{pedido.itens?.length || 0}</dd></div>
                                            <div className="col-span-2"><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Valor total</dt><dd className="mt-0.5 break-words text-lg font-bold text-gray-900">{formatCurrency(pedido.valorTotal)}</dd></div>
                                        </dl>
                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                            <button onClick={() => abrirDetalhes(pedido)} className="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">Ver detalhes e IA</button>
                                            {pedido.status === 'PENDENTE' && <button onClick={() => abrirModal(pedido)} className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Editar</button>}
                                            {transicoes[pedido.status]?.some(status => podeCancelar || status !== 'CANCELADO') && <button onClick={() => setStatusChangeId(statusChangeId === pedido.id ? null : pedido.id)} aria-expanded={statusChangeId === pedido.id} className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100">Mudar status</button>}
                                            {podeCancelar && pedido.status !== 'ENTREGUE' && pedido.status !== 'CANCELADO' && <button onClick={() => confirmarExclusao(pedido.id)} className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Cancelar</button>}
                                        </div>
                                        {statusChangeId === pedido.id && transicoes[pedido.status]?.length > 0 && <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/50 p-3">
                                            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Avançar para</p>
                                            <div className="grid gap-2">{transicoes[pedido.status].filter(status => podeCancelar || status !== 'CANCELADO').map((proxStatus) => <button key={proxStatus} onClick={() => executarMudancaStatus(pedido.id, proxStatus)} className="rounded-xl bg-white px-3 py-2 text-left text-sm font-medium text-gray-800 shadow-sm hover:text-indigo-700">{labels[proxStatus] || proxStatus}</button>)}</div>
                                        </div>}
                                    </article>
                                ))}
                            </div>
                        <div className="hidden overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm md:block">
                            <div className="overflow-x-auto" role="region" aria-label="Tabela de pedidos" tabIndex={0}>
                                <table className="w-full min-w-[850px] text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                                        <tr>
                                            <th className="px-6 py-4"><button onClick={() => ordenar('id')}>ID{indicador('id')}</button></th>
                                            <th className="px-6 py-4"><button onClick={() => ordenar('nomeCliente')}>Cliente{indicador('nomeCliente')}</button></th>
                                            <th className="px-6 py-4"><button onClick={() => ordenar('dataPedido')}>Data{indicador('dataPedido')}</button></th>
                                            <th className="px-6 py-4"><button onClick={() => ordenar('status')}>Status{indicador('status')}</button></th>
                                            <th className="px-6 py-4 text-center">Itens</th>
                                            <th className="px-6 py-4 text-right"><button onClick={() => ordenar('valorTotal')}>Valor Total{indicador('valorTotal')}</button></th>
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
                                                            className="min-h-11 min-w-11 rounded-lg p-2.5 text-gray-600 transition hover:bg-indigo-50 hover:text-indigo-600"
                                                            title="Ver detalhes e Previsão IA"
                                                            aria-label={`Ver detalhes e previsão do pedido ${pedido.id}`}
                                                        >
                                                            👁
                                                        </button>

                                                        {/* Editar (somente PENDENTE) */}
                                                        {pedido.status === 'PENDENTE' && (
                                                            <button
                                                                onClick={() => abrirModal(pedido)}
                                                                className="min-h-11 min-w-11 rounded-lg p-2.5 text-gray-600 transition hover:bg-blue-50 hover:text-blue-600"
                                                                title="Editar pedido"
                                                                aria-label={`Editar pedido ${pedido.id}`}
                                                            >
                                                                ✎
                                                            </button>
                                                        )}

                                                        {/* Transições de Status */}
                                                        {transicoes[pedido.status]?.some(status => podeCancelar || status !== 'CANCELADO') && (
                                                            <select value="" onChange={(event) => event.target.value && void executarMudancaStatus(pedido.id, event.target.value)} aria-label={`Mudar status do pedido ${pedido.id}`} className="min-h-11 max-w-40 rounded-lg border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-800">
                                                                <option value="">Status...</option>
                                                                {transicoes[pedido.status].filter(status => podeCancelar || status !== 'CANCELADO').map((proxStatus) => <option key={proxStatus} value={proxStatus}>{labels[proxStatus] || proxStatus}</option>)}
                                                            </select>
                                                        )}

                                                        {/* Cancelar */}
                                                        {podeCancelar && pedido.status !== 'ENTREGUE' && pedido.status !== 'CANCELADO' && (
                                                            <button
                                                                onClick={() => confirmarExclusao(pedido.id)}
                                                                className="min-h-11 min-w-11 rounded-lg p-2.5 text-gray-600 transition hover:bg-red-50 hover:text-red-600"
                                                                title="Cancelar pedido"
                                                                aria-label={`Cancelar pedido ${pedido.id}`}
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
                        </>
                    )}
                </div>
            </div>

            {/* MODAL DETALHES DO PEDIDO + IA */}
            {detalhesOpen && pedidoDetalhe && (
                <div className="agerp-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="detalhes-pedido-titulo">
                    <div className="agerp-modal-panel w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-3xl border-b border-gray-100 bg-white p-4 sm:p-6">
                            <div className="min-w-0">
                                <h2 id="detalhes-pedido-titulo" className="flex flex-wrap items-center gap-2 text-xl font-bold text-gray-900">
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
                                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-2xl text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                aria-label="Fechar detalhes do pedido"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-6 p-4 sm:p-6">
                            {/* DADOS BÁSICOS */}
                            <div className="grid grid-cols-1 gap-4 rounded-2xl bg-gray-50 p-4 text-sm sm:grid-cols-2">
                                <div>
                                    <span className="text-gray-500 text-xs block">Cliente</span>
                                    <span className="font-semibold text-gray-900">{pedidoDetalhe.nomeCliente}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 text-xs block">Responsável</span>
                                    <span className="font-semibold text-gray-900">{pedidoDetalhe.nomeUsuario || 'Sistema'}</span>
                                </div>
                                <div className="border-t border-gray-200/60 pt-2 sm:col-span-2">
                                    <span className="text-gray-500 text-xs block">Endereço de Entrega</span>
                                    <span className="mt-0.5 flex min-w-0 items-start gap-1.5 break-words font-semibold text-gray-900">
                                        <span>📍</span>
                                        {pedidoDetalhe.enderecoResumo || (
                                            <span className="text-gray-400 font-normal italic">Nenhum endereço vinculado (Retirada ou Padrão)</span>
                                        )}
                                    </span>
                                </div>
                                {pedidoDetalhe.observacoes && (
                                    <div className="border-t border-gray-200/60 pt-2 sm:col-span-2">
                                        <span className="text-gray-500 text-xs block">Observações</span>
                                        <span className="text-gray-700 text-xs mt-0.5 block whitespace-pre-wrap">
                                            {pedidoDetalhe.observacoes}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* PAINEL DE INTELIGÊNCIA ARTIFICIAL - PREVISÃO DE ENTREGA */}
                            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 sm:p-5">
                                <div className="mb-3 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                                    <h3 className="flex min-w-0 items-start gap-2 break-words text-sm font-bold text-indigo-950">
                                        <span>⚡</span> Previsão de Entrega Inteligente (Machine Learning)
                                    </h3>
                                    <button
                                        onClick={() => carregarPrevisaoIa(pedidoDetalhe.id)}
                                        disabled={loadingPrevisao}
                                        className="min-h-11 rounded-xl px-3 text-xs font-semibold text-indigo-600 hover:bg-white/70 hover:text-indigo-800"
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
                                        <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
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
                                        <div className="flex min-w-0 flex-col gap-2 px-1 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
                                            <span className="min-w-0 break-words">Rota: <strong>{previsaoIa.cidadeOrigem}/{previsaoIa.estadoOrigem} → {previsaoIa.cidadeDestino}/{previsaoIa.estadoDestino}</strong></span>
                                            <span className="shrink-0 font-medium text-indigo-700">{previsaoIa.modeloVersao}</span>
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
                                <div className="grid gap-2 sm:hidden">
                                    {pedidoDetalhe.itens?.map((item) => <div key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-sm">
                                        <p className="break-words font-medium text-gray-900">{item.nomeProduto}</p>
                                        <dl className="mt-2 grid grid-cols-2 gap-2"><div><dt className="text-xs text-gray-500">Quantidade</dt><dd className="font-semibold">{item.quantidade}</dd></div><div><dt className="text-xs text-gray-500">Preço unitário</dt><dd>{formatCurrency(item.precoUnitario)}</dd></div><div className="col-span-2"><dt className="text-xs text-gray-500">Subtotal</dt><dd className="break-words font-bold">{formatCurrency(item.subtotal)}</dd></div></dl>
                                    </div>)}
                                </div>
                                <div className="hidden overflow-x-auto rounded-2xl border border-gray-100 sm:block">
                                    <table className="w-full min-w-[560px] text-left text-sm">
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
                            <div className="flex flex-col gap-1 rounded-2xl bg-gray-50 p-4 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
                                <span className="font-semibold text-gray-700">Total do Pedido</span>
                                <span className="break-words text-2xl font-bold text-indigo-600">
                                    {formatCurrency(pedidoDetalhe.valorTotal)}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-end border-t border-gray-100 p-4 sm:p-6">
                            <button
                                onClick={() => setDetalhesOpen(false)}
                                className="min-h-11 w-full rounded-xl bg-gray-100 px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200 sm:w-auto"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CRIAÇÃO / EDIÇÃO */}
            {modalOpen && (
                <div className="agerp-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="pedido-modal-titulo">
                    <div className="agerp-modal-panel w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
                        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-3xl border-b border-gray-100 bg-white p-4 sm:p-6">
                            <h2 id="pedido-modal-titulo" className="min-w-0 break-words text-xl font-bold text-gray-900">
                                {editandoId ? `Editar Pedido #${editandoId}` : 'Novo Pedido'}
                            </h2>
                            <button
                                onClick={fecharModal}
                                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-2xl text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                aria-label="Fechar formulário de pedido"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-6 p-4 sm:p-6">
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
                                <div className="mb-2 flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center">
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
                                    <div className="mt-2 break-words rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
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
                                <div className="mb-3 flex flex-col items-start justify-between gap-2 min-[360px]:flex-row min-[360px]:items-center">
                                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Produtos e Quantidades *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={adicionarItem}
                                        className="min-h-11 rounded-xl px-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800"
                                    >
                                        + Adicionar Produto
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {formData.itens.map((item, index) => (
                                        <div key={index} className="grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto] sm:items-center">
                                            <div className="min-w-0">
                                                <label htmlFor={`produto-item-${index}`} className="mb-1 block text-xs text-gray-500 sm:sr-only">Produto {index + 1}</label>
                                                <select
                                                    id={`produto-item-${index}`}
                                                    value={item.idProduto}
                                                    onChange={(e) => atualizarItem(index, 'idProduto', e.target.value)}
                                                    disabled={loadingProdutos || erroProdutos}
                                                    aria-describedby={`estoque-produto-${index}`}
                                                    className="min-h-11 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                                                >
                                                    <option value="">{loadingProdutos ? 'Atualizando estoque...' : erroProdutos ? 'Erro ao carregar produtos' : 'Selecione um produto...'}</option>
                                                    {produtos.filter(p => p.ativo).map(p => (
                                                        <option key={p.id} value={p.id} title={rotuloProduto(p)}>
                                                            {rotuloProduto(p)}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div id={`estoque-produto-${index}`} className="mt-1.5 min-w-0 text-xs leading-relaxed text-gray-600" aria-live="polite">
                                                    {loadingProdutos ? 'Consultando estoque atual...' : erroProdutos ? (
                                                        <button type="button" className="text-rose-700 underline" onClick={() => void carregarProdutos(true)}>Não foi possível carregar os produtos. Tentar novamente</button>
                                                    ) : produtos.filter(p => String(p.id) === item.idProduto).map(p => (
                                                        <p key={p.id} className="break-words [overflow-wrap:anywhere]">
                                                            <span className="font-medium text-gray-800">{p.nome}</span>
                                                            <span className="block">Cód. #{p.id} · {formatCurrency(p.preco)} · <span className={p.quantidadeAtual === 0 ? 'font-semibold text-amber-700' : 'font-semibold text-gray-700'}>{formatarEstoqueProduto(p)}</span></span>
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="w-full sm:w-24">
                                                <label htmlFor={`quantidade-item-${index}`} className="mb-1 block text-xs text-gray-500 sm:sr-only">Quantidade</label>
                                                <input
                                                    id={`quantidade-item-${index}`}
                                                    type="number"
                                                    min="1"
                                                    value={item.quantidade}
                                                    onChange={(e) => atualizarItem(index, 'quantidade', e.target.value)}
                                                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-center"
                                                    placeholder="Qtd"
                                                />
                                            </div>
                                            {formData.itens.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removerItem(index)}
                                                    className="min-h-11 w-full rounded-xl px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 sm:min-w-11 sm:w-auto"
                                                    title="Remover produto"
                                                    aria-label={`Remover produto ${index + 1}`}
                                                >
                                                    <span aria-hidden="true">✕</span><span className="ml-2 sm:sr-only">Remover produto</span>
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
                            <div className="flex flex-col gap-1 rounded-2xl bg-gray-50 p-4 text-sm min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
                                <span className="text-gray-600">Total Previsto:</span>
                                <span className="break-words text-xl font-bold text-gray-900">
                                    {formatCurrency(calcularTotalVisual())}
                                </span>
                            </div>
                        </div>

                        <div className="sticky bottom-0 flex flex-col-reverse items-stretch justify-end gap-2 rounded-b-3xl border-t border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:p-6">
                            <button
                                type="button"
                                onClick={fecharModal}
                                className="min-h-11 rounded-xl px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-800"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={salvarPedido}
                                disabled={salvando}
                                className="min-h-11 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {salvando ? 'Salvando...' : editandoId ? 'Atualizar Pedido' : 'Criar Pedido'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMAÇÃO DE CANCELAMENTO */}
            {deleteConfirmId && podeCancelar && (
                <div className="agerp-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cancelar-pedido-titulo">
                    <div className="agerp-modal-panel w-full max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl sm:p-6">
                        <span className="text-4xl block mb-3">⚠️</span>
                        <h3 id="cancelar-pedido-titulo" className="mb-2 text-lg font-bold text-gray-900">Cancelar Pedido?</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            Tem certeza que deseja cancelar o pedido #{deleteConfirmId}? Se o estoque já foi baixado, ele será estornado automaticamente.
                        </p>
                        <div className="flex flex-col-reverse justify-center gap-3 min-[360px]:flex-row">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="min-h-11 rounded-xl px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={executarExclusao}
                                className="min-h-11 rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                            >
                                Sim, Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TOASTS */}
            <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 space-y-2 sm:left-auto sm:right-6 sm:max-w-md">
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
