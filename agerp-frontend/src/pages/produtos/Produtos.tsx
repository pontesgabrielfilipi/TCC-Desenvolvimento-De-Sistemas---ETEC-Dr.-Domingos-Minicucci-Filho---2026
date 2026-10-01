import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { produtoService } from '../../services/produtoService';

interface Produto {
    id: number;
    nome: string;
    descricao: string;
    preco: number;
    custo: number;
    peso: number;
    volume: number;
    ativo: boolean;
    quantidadeAtual: number;
    quantidadeMinima: number;
}

interface Toast {
    id: number;
    type: 'success' | 'error';
    message: string;
}

const Produtos = () => {
    const { user, logout } = useAuth();

    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [busca, setBusca] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [editandoId, setEditandoId] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        nome: '',
        descricao: '',
        preco: '',
        custo: '',
        peso: '',
        volume: '',
        quantidadeInicial: 0,
        quantidadeMinima: 10,
    });

    // Popover de exclusão
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

    // Toasts
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (type: 'success' | 'error', message: string) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    const carregarProdutos = async () => {
        try {
            setLoading(true);
            const response = await produtoService.listar();
            setProdutos(response.data);
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
            showToast('error', 'Erro ao carregar lista de produtos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarProdutos();
    }, []);

    const produtosFiltrados = produtos.filter((p) =>
        p.nome.toLowerCase().includes(busca.toLowerCase())
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const abrirModal = (produto?: Produto) => {
        if (produto) {
            setEditandoId(produto.id);
            setFormData({
                nome: produto.nome,
                descricao: produto.descricao || '',
                preco: produto.preco.toString(),
                custo: produto.custo.toString(),
                peso: produto.peso.toString(),
                volume: produto.volume.toString(),
                quantidadeInicial: produto.quantidadeAtual,
                quantidadeMinima: produto.quantidadeMinima,
            });
        } else {
            setEditandoId(null);
            setFormData({
                nome: '',
                descricao: '',
                preco: '',
                custo: '',
                peso: '',
                volume: '',
                quantidadeInicial: 0,
                quantidadeMinima: 10,
            });
        }
        setModalOpen(true);
    };

    const fecharModal = () => {
        setModalOpen(false);
        setEditandoId(null);
    };

    // ==================== VALIDAÇÃO EXATA DO DTO ====================
    const validarFormulario = (): boolean => {
        if (!formData.nome.trim()) {
            showToast('error', 'Nome do produto é obrigatório');
            return false;
        }
        if (formData.nome.length > 150) {
            showToast('error', 'Nome deve ter no máximo 150 caracteres');
            return false;
        }
        const precoNum = parseFloat(formData.preco);
        if (!formData.preco || precoNum <= 0) {
            showToast('error', 'Preço deve ser maior que zero');
            return false;
        }
        const custoNum = parseFloat(formData.custo || '0');
        if (custoNum < 0) {
            showToast('error', 'Custo não pode ser negativo');
            return false;
        }
        const pesoNum = parseFloat(formData.peso || '0');
        if (pesoNum < 0) {
            showToast('error', 'Peso não pode ser negativo');
            return false;
        }
        const volumeNum = parseFloat(formData.volume || '0');
        if (volumeNum < 0) {
            showToast('error', 'Volume não pode ser negativo');
            return false;
        }
        if (parseFloat(formData.preco) < custoNum) {
            showToast('error', 'Preço de venda não pode ser menor que o custo');
            return false;
        }
        return true;
    };

    const salvarProduto = async () => {
        if (!validarFormulario()) return;

        try {
            const payload = {
                nome: formData.nome.trim(),
                descricao: formData.descricao.trim(),
                preco: parseFloat(formData.preco),
                custo: parseFloat(formData.custo) || 0,
                peso: parseFloat(formData.peso) || 0,
                volume: parseFloat(formData.volume) || 0,
                quantidadeInicial: formData.quantidadeInicial,
                quantidadeMinima: formData.quantidadeMinima,
            };

            if (editandoId) {
                await produtoService.atualizar(editandoId, payload);
                showToast('success', 'Produto atualizado com sucesso!');
            } else {
                await produtoService.criar(payload);
                showToast('success', 'Produto cadastrado com sucesso!');
            }

            fecharModal();
            await carregarProdutos();
        } catch (error: any) {
            const errorMsg =
                error.response?.data?.message ||
                error.response?.data?.error ||
                error.response?.data ||
                error.message ||
                '';

            console.warn('Mensagem extraída:', errorMsg);

            if (errorMsg.toString().includes('Já existe um produto com este nome')) {
                showToast('error', 'Já existe um produto com este nome. Escolha outro nome.');
            } else {
                showToast('error', 'Erro ao salvar produto');
            }
        }
    };

    const confirmarExclusao = (id: number) => setDeleteConfirmId(id);

    const executarExclusao = async () => {
        if (!deleteConfirmId) return;
        try {
            await produtoService.excluir(deleteConfirmId);
            showToast('success', 'Produto excluído com sucesso!');
            carregarProdutos();
        } catch {
            showToast('error', 'Erro ao excluir produto');
        } finally {
            setDeleteConfirmId(null);
        }
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
                    <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline">📊 Dashboard</Link>
                    <Link to="/clientes" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline">👥 Clientes</Link>
                    <Link to="/produtos" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 text-white font-medium no-underline">📦 Produtos</Link>
                    <Link to="/pedidos" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline">📋 Pedidos</Link>
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
                            <p className="text-xs text-slate-400">Online</p>
                        </div>
                    </div>
                    <button onClick={logout} className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg mt-1 w-full py-2 text-red-400 hover:bg-slate-800 rounded-xl">
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
                    <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline">📊 Dashboard</Link>
                    <Link to="/clientes" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline">👥 Clientes</Link>
                    <Link to="/produtos" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 text-white font-medium no-underline">📦 Produtos</Link>
                    <Link to="/pedidos" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline">📋 Pedidos</Link>
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
                            <p className="text-xs text-slate-400">Online</p>
                        </div>
                    </div>
                    <button onClick={logout} className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg mt-6 w-full py-3 text-red-400 hover:bg-slate-800 rounded-xl">Sair da conta</button>
                </div>
            </div>

            {/* Overlay mobile */}
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
            )}

            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* HEADER */}
                <header className="bg-white border-b px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-3xl text-gray-700">☰</button>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">📦 Produtos</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <input
                            type="text"
                            placeholder="Buscar por nome do produto..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-80 px-5 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:border-indigo-500 text-sm"
                        />
                        <button
                            onClick={() => abrirModal()}
                            className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-medium flex items-center gap-2"
                        >
                            + Novo Produto
                        </button>
                    </div>
                </header>

                {/* CONTEÚDO COM SCROLL */}
                <div className="p-6 md:p-8 flex-1 overflow-auto">
                    {loading ? (
                        <div className="text-center py-16 text-gray-500 font-medium">Carregando produtos...</div>
                    ) : (
                        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-4 text-left">Nome</th>
                                <th className="px-6 py-4 text-left">Preço</th>
                                <th className="px-6 py-4 text-left">Custo</th>
                                <th className="px-6 py-4 text-center">Estoque Atual</th>
                                <th className="px-6 py-4 text-center">Mínimo</th>
                                <th className="px-6 py-4 text-center">Ativo</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y">
                            {produtosFiltrados.map((produto) => (
                                <tr key={produto.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4 font-medium">{produto.nome}</td>
                                    <td className="px-6 py-4">R$ {(produto.preco ?? 0).toFixed(2)}</td>
                                    <td className="px-6 py-4">R$ {produto.custo != null ? produto.custo.toFixed(2) : "—"}</td>
                                    <td className="px-6 py-4 text-center font-bold">{(produto.quantidadeAtual ?? 0)}</td>
                                    <td className="px-6 py-4 text-center">{(produto.quantidadeMinima ?? 0)}</td>
                                    <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 text-xs rounded-full ${produto.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {produto.ativo ? 'Sim' : 'Não'}
                                            </span>
                                    </td>
                                    <td className="px-6 py-4 text-center space-x-4">
                                        <button onClick={() => abrirModal(produto)} className="text-indigo-600 hover:text-indigo-700">Editar</button>
                                        <button onClick={() => confirmarExclusao(produto.id)} className="text-red-600 hover:text-red-700">Excluir</button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                    )}
                </div>
            </div>

            {/* Modal Novo / Editar Produto - com validações do DTO */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl w-full max-w-lg mx-4 p-8 max-h-[90vh] overflow-auto">
                        <h2 className="text-2xl font-semibold mb-6">
                            {editandoId ? 'Editar Produto' : 'Novo Produto'}
                        </h2>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto *</label>
                                <input
                                    type="text"
                                    name="nome"
                                    value={formData.nome}
                                    onChange={handleChange}
                                    className="w-full rounded-2xl border border-gray-300 py-3 px-4 focus:border-indigo-500 focus:ring-0"
                                    maxLength={150}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                <textarea
                                    name="descricao"
                                    value={formData.descricao}
                                    onChange={handleChange}
                                    rows={3}
                                    className="w-full rounded-2xl border border-gray-300 py-3 px-4 focus:border-indigo-500 focus:ring-0"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$) *</label>
                                    <input
                                        type="number"
                                        name="preco"
                                        value={formData.preco}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-gray-300 py-3 px-4 focus:border-indigo-500 focus:ring-0"
                                        step="0.01"
                                        min="0.01"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Custo (R$)</label>
                                    <input
                                        type="number"
                                        name="custo"
                                        value={formData.custo}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-gray-300 py-3 px-4 focus:border-indigo-500 focus:ring-0"
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
                                    <input
                                        type="number"
                                        name="peso"
                                        value={formData.peso}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-gray-300 py-3 px-4 focus:border-indigo-500 focus:ring-0"
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Volume (m³)</label>
                                    <input
                                        type="number"
                                        name="volume"
                                        value={formData.volume}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-gray-300 py-3 px-4 focus:border-indigo-500 focus:ring-0"
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Qtd. Inicial</label>
                                    <input
                                        type="number"
                                        name="quantidadeInicial"
                                        value={formData.quantidadeInicial}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-gray-300 py-3 px-4 focus:border-indigo-500 focus:ring-0"
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button onClick={fecharModal} className="flex-1 py-3.5 border border-gray-300 rounded-2xl font-medium">Cancelar</button>
                                <button onClick={salvarProduto} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl font-medium hover:bg-indigo-700">Salvar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Popover de Confirmação de Exclusão */}
            {deleteConfirmId && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[110]">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4">
                        <h3 className="text-lg font-semibold">Confirmar exclusão</h3>
                        <p className="text-gray-600 mt-2 mb-8">Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3.5 border border-gray-300 rounded-2xl">Cancelar</button>
                            <button onClick={executarExclusao} className="flex-1 py-3.5 bg-red-600 text-white rounded-2xl">Excluir</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toasts */}
            <div className="fixed bottom-6 right-6 space-y-2 z-[120]">
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

export default Produtos;