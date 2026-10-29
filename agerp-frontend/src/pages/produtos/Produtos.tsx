// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { produtoService } from '../../services/produtoService';
import { getHttpErrorMessage } from '../../utils/httpError';
import { useIsMobileViewport } from '../../hooks/useIsMobileViewport';
import { useAuth } from '../../contexts/AuthContext';

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
    quantidadeMinima: number | null;
    minimoAplicado: number;
    estoqueBaixo: boolean;
    usarEstoqueMinimoGeral: boolean;
}

interface Toast {
    id: number;
    type: 'success' | 'error';
    message: string;
}

const Produtos = () => {
    const isMobileViewport = useIsMobileViewport();
    const { user } = useAuth();
    const podeExcluir = (user?.nivelAutoridade ?? 0) >= 60 && user?.paginas?.includes('PRODUTOS');

    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [busca, setBusca] = useState('');
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState<{ key: keyof Produto; direction: 'asc' | 'desc' }>({ key: 'nome', direction: 'asc' });

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
        ativo: true,
    });

    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((type: 'success' | 'error', message: string) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const carregarProdutos = useCallback(async (refresh = false) => {
        try {
            setLoading(true);
            const response = await produtoService.listar(refresh);
            setProdutos(response.data);
            if (refresh) showToast('success', 'Produtos atualizados com sucesso.');
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
            showToast('error', 'Erro ao carregar lista de produtos');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        carregarProdutos();
        const atualizar = () => { void carregarProdutos(); };
        window.addEventListener('agerp:configuracoes-atualizadas', atualizar);
        return () => window.removeEventListener('agerp:configuracoes-atualizadas', atualizar);
    }, [carregarProdutos]);

    const produtosFiltrados = useMemo(() => {
        const termo = busca.trim().toLocaleLowerCase('pt-BR');
        const filtrados = produtos.filter(p => !termo || [p.id, p.nome, p.descricao, p.ativo ? 'ativo' : 'inativo']
            .some(valor => String(valor ?? '').toLocaleLowerCase('pt-BR').includes(termo)));
        return [...filtrados].sort((a, b) => {
            const av = a[sort.key] ?? '';
            const bv = b[sort.key] ?? '';
            const resultado = typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : String(av).localeCompare(String(bv), 'pt-BR', { numeric: true, sensitivity: 'base' });
            return sort.direction === 'asc' ? resultado : -resultado;
        });
    }, [busca, produtos, sort]);

    const ordenar = (key: keyof Produto) => setSort(atual => ({
        key,
        direction: atual.key === key && atual.direction === 'asc' ? 'desc' : 'asc'
    }));
    const indicador = (key: keyof Produto) => sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : '';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const abrirModal = (produto?: Produto) => {
        if (produto) {
            setEditandoId(produto.id);
            setFormData({
                nome: produto.nome || '',
                descricao: produto.descricao || '',
                preco: produto.preco != null ? String(produto.preco) : '',
                custo: produto.custo != null ? String(produto.custo) : '',
                peso: produto.peso != null ? String(produto.peso) : '',
                volume: produto.volume != null ? String(produto.volume) : '',
                quantidadeInicial: produto.quantidadeAtual ?? 0,
                quantidadeMinima: produto.quantidadeMinima ?? 10,
                ativo: produto.ativo ?? true,
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
                ativo: true,
            });
        }
        setModalOpen(true);
    };

    const fecharModal = () => {
        setModalOpen(false);
        setEditandoId(null);
    };

    const validarFormulario = (): boolean => {
        if (!formData.nome.trim()) {
            showToast('error', 'Nome do produto é obrigatório');
            return false;
        }
        if (formData.nome.trim().length > 150) {
            showToast('error', 'Nome deve ter no máximo 150 caracteres');
            return false;
        }
        const precoNum = parseFloat(formData.preco);
        if (!formData.preco || isNaN(precoNum) || precoNum <= 0) {
            showToast('error', 'Preço deve ser maior que zero');
            return false;
        }
        const custoNum = formData.custo !== '' ? parseFloat(formData.custo) : 0;
        if (isNaN(custoNum) || custoNum < 0) {
            showToast('error', 'Custo não pode ser negativo');
            return false;
        }
        const pesoNum = formData.peso !== '' ? parseFloat(formData.peso) : 0;
        if (isNaN(pesoNum) || pesoNum < 0) {
            showToast('error', 'Peso não pode ser negativo');
            return false;
        }
        const volumeNum = formData.volume !== '' ? parseFloat(formData.volume) : 0;
        if (isNaN(volumeNum) || volumeNum < 0) {
            showToast('error', 'Volume não pode ser negativo');
            return false;
        }
        if (precoNum < custoNum) {
            showToast('error', 'Preço de venda não pode ser menor que o custo');
            return false;
        }
        if (![formData.quantidadeInicial, formData.quantidadeMinima].every(valor =>
            String(valor).trim() !== '' && Number.isSafeInteger(Number(valor)) && Number(valor) >= 0 && Number(valor) <= 2147483647)) {
            showToast('error', 'Estoque atual e mínimo devem ser números inteiros não negativos.');
            return false;
        }
        return true;
    };

    const salvarProduto = async () => {
        if (!validarFormulario()) return;

        try {
            const precoNum = parseFloat(formData.preco);
            const custoNum = formData.custo !== '' ? parseFloat(formData.custo) : 0;
            const pesoNum = formData.peso !== '' ? parseFloat(formData.peso) : 0;
            const volumeNum = formData.volume !== '' ? parseFloat(formData.volume) : 0;
            const qtdNum = Number(formData.quantidadeInicial) || 0;
            const qtdMinNum = Number(formData.quantidadeMinima) || 0;

            if (editandoId) {
                const payload = {
                    nome: formData.nome.trim(),
                    descricao: formData.descricao.trim(),
                    preco: precoNum,
                    custo: custoNum,
                    peso: pesoNum,
                    volume: volumeNum,
                    ativo: formData.ativo,
                    quantidadeAtual: qtdNum,
                    quantidadeMinima: qtdMinNum,
                };
                await produtoService.atualizar(editandoId, payload);
                showToast('success', 'Produto atualizado com sucesso!');
            } else {
                const payload = {
                    nome: formData.nome.trim(),
                    descricao: formData.descricao.trim(),
                    preco: precoNum,
                    custo: custoNum,
                    peso: pesoNum,
                    volume: volumeNum,
                    quantidadeInicial: qtdNum,
                    quantidadeMinima: qtdMinNum,
                };
                await produtoService.criar(payload);
                showToast('success', 'Produto cadastrado com sucesso!');
            }

            fecharModal();
            await carregarProdutos();
        } catch (error: unknown) {
            const errorMsg = getHttpErrorMessage(error, '');

            console.warn('Mensagem extraída:', errorMsg);

            const msgStr = errorMsg.toString();
            if (msgStr.toLowerCase().includes('já existe') || msgStr.toLowerCase().includes('ja existe')) {
                showToast('error', msgStr.includes('outro produto')
                    ? 'Já existe outro produto com este nome. Escolha outro nome.'
                    : 'Já existe um produto com este nome. Escolha outro nome.');
            } else if (msgStr) {
                showToast('error', msgStr);
            } else {
                showToast('error', editandoId ? 'Erro ao atualizar produto' : 'Erro ao cadastrar produto');
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

    const campoBusca = (
        <input
            type="text"
            placeholder="Buscar por nome do produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar produtos"
            className={isMobileViewport
                ? 'mb-3 block w-full min-w-0 rounded-2xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none'
                : 'min-w-0 w-72 rounded-2xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none'}
        />
    );

    return (
        <div className="h-full min-w-0 bg-app-background flex overflow-hidden">

            <div className="flex-1 flex flex-col overflow-hidden">

                <header className="bg-white border-b px-3 sm:px-6 py-3 sm:py-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="hidden min-w-0 items-center gap-4 sm:flex">
                        <h1 className="flex items-center gap-3 text-xl font-bold text-gray-900 sm:text-3xl">📦 Produtos</h1>
                    </div>

                    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:gap-4">
                        {!isMobileViewport && campoBusca}
                        <button
                            onClick={() => void carregarProdutos(true)}
                            disabled={loading}
                            className="min-h-11 flex-1 whitespace-nowrap rounded-2xl border border-gray-300 px-3 py-3 font-medium hover:bg-gray-50 disabled:opacity-50 sm:flex-none sm:px-4"
                        >{loading ? 'Atualizando...' : '↻ Atualizar'}</button>
                        <button
                            onClick={() => abrirModal()}
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-indigo-600 px-3 py-3 font-medium text-white transition-all duration-300 ease-in-out hover:scale-105 hover:bg-indigo-700 hover:shadow-lg sm:flex-none sm:px-6"
                        >
                            + Novo Produto
                        </button>
                    </div>
                </header>

                <div data-testid="produtos-scroll" className="min-w-0 p-3 sm:p-6 md:p-8 flex-1 overflow-y-auto overflow-x-hidden">
                    {isMobileViewport && campoBusca}
                    {loading ? (
                        <div className="text-center py-16 text-gray-500 font-medium">Carregando produtos...</div>
                    ) : produtosFiltrados.length === 0 ? (
                        <div className="rounded-3xl bg-white p-8 text-center text-gray-500 shadow-sm">Nenhum produto encontrado.</div>
                    ) : (<>
                        <div className="mb-3 flex items-center gap-2 md:hidden">
                            <label htmlFor="ordenacao-produtos-mobile" className="shrink-0 text-sm font-medium text-gray-600">Ordenar:</label>
                            <select id="ordenacao-produtos-mobile" value={String(sort.key)} onChange={(event) => setSort(atual => ({ ...atual, key: event.target.value as keyof Produto }))} className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm">
                                <option value="nome">Nome</option><option value="preco">Preço</option><option value="custo">Custo</option><option value="quantidadeAtual">Estoque atual</option><option value="minimoAplicado">Mínimo aplicado</option><option value="ativo">Ativo</option>
                            </select>
                            <button type="button" onClick={() => setSort(atual => ({ ...atual, direction: atual.direction === 'asc' ? 'desc' : 'asc' }))} className="min-h-11 min-w-11 rounded-xl border border-gray-300 bg-white px-3" aria-label={`Ordem ${sort.direction === 'asc' ? 'crescente' : 'decrescente'}; alternar direção`}>{sort.direction === 'asc' ? '↑' : '↓'}</button>
                        </div>
                        <div className="grid gap-3 md:hidden" aria-label="Lista de produtos">
                            {produtosFiltrados.map((produto) => (
                                <article key={produto.id} className="agerp-mobile-card rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                        <h2 className="min-w-0 break-words font-semibold text-gray-900">{produto.nome}</h2>
                                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${produto.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{produto.ativo ? 'Ativo' : 'Inativo'}</span>
                                    </div>
                                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                        <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Preço</dt><dd className="mt-0.5 break-words font-semibold text-gray-900">R$ {(produto.preco ?? 0).toFixed(2)}</dd></div>
                                        <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Custo</dt><dd className="mt-0.5 break-words text-gray-800">{produto.custo != null ? `R$ ${produto.custo.toFixed(2)}` : '—'}</dd></div>
                                        <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Estoque atual</dt><dd className="mt-0.5 font-bold text-gray-900">{produto.quantidadeAtual ?? 0}</dd></div>
                                        <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Mínimo aplicado</dt><dd className="mt-0.5 text-gray-800">{produto.minimoAplicado} {produto.usarEstoqueMinimoGeral ? '(geral)' : '(individual)'}</dd></div>
                                    </dl>
                                    {produto.estoqueBaixo && <p className="mt-3 text-sm font-semibold text-red-700">Estoque baixo</p>}
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                        <button onClick={() => abrirModal(produto)} className="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">Editar</button>
                                        {podeExcluir && <button onClick={() => confirmarExclusao(produto.id)} className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Excluir</button>}
                                    </div>
                                </article>
                            ))}
                        </div>
                        <div className="hidden rounded-3xl bg-white shadow-sm md:block md:overflow-x-auto" role="region" aria-label="Tabela de produtos" tabIndex={0}>
                        <table className="w-full min-w-[800px]">
                            <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-4 text-left"><button onClick={() => ordenar('nome')}>Nome{indicador('nome')}</button></th>
                                <th className="px-6 py-4 text-left"><button onClick={() => ordenar('preco')}>Preço{indicador('preco')}</button></th>
                                <th className="px-6 py-4 text-left"><button onClick={() => ordenar('custo')}>Custo{indicador('custo')}</button></th>
                                <th className="px-6 py-4 text-center"><button onClick={() => ordenar('quantidadeAtual')}>Estoque Atual{indicador('quantidadeAtual')}</button></th>
                                <th className="px-6 py-4 text-center"><button onClick={() => ordenar('minimoAplicado')}>Mínimo aplicado{indicador('minimoAplicado')}</button></th>
                                <th className="px-6 py-4 text-center"><button onClick={() => ordenar('ativo')}>Ativo{indicador('ativo')}</button></th>
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
                                    <td className="px-6 py-4 text-center">{produto.minimoAplicado} {produto.estoqueBaixo && <span className="block text-xs font-semibold text-red-700">Estoque baixo</span>}</td>
                                    <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 text-xs rounded-full ${produto.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {produto.ativo ? 'Sim' : 'Não'}
                                            </span>
                                    </td>
                                    <td className="px-6 py-4 text-center space-x-4">
                                        <button onClick={() => abrirModal(produto)} className="text-indigo-600 hover:text-indigo-700">Editar</button>
                                        {podeExcluir && <button onClick={() => confirmarExclusao(produto.id)} className="text-red-600 hover:text-red-700">Excluir</button>}
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
                <div className="agerp-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="produto-modal-titulo">
                    <div className="agerp-modal-panel w-full max-w-lg rounded-3xl bg-white p-4 sm:p-8">
                        <h2 id="produto-modal-titulo" className="mb-6 text-xl font-semibold sm:text-2xl">
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

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {editandoId ? 'Estoque Atual' : 'Qtd. Inicial'}
                                    </label>
                                    <input
                                        type="number"
                                        name="quantidadeInicial"
                                        value={formData.quantidadeInicial}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-gray-300 py-3 px-4 focus:border-indigo-500 focus:ring-0"
                                        min="0"
                                        step="1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Estoque mínimo individual</label>
                                    <input
                                        type="number"
                                        name="quantidadeMinima"
                                        value={formData.quantidadeMinima}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-gray-300 py-3 px-4 focus:border-indigo-500 focus:ring-0"
                                        min="0"
                                        step="1"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Este valor fica salvo mesmo quando o estoque mínimo geral está habilitado.</p>
                                </div>
                            </div>

                            {editandoId && (
                                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                    <input
                                        type="checkbox"
                                        id="ativo"
                                        name="ativo"
                                        checked={formData.ativo}
                                        onChange={(e) => setFormData(prev => ({ ...prev, ativo: e.target.checked }))}
                                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 cursor-pointer"
                                    />
                                    <label htmlFor="ativo" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                                        Produto ativo no catálogo
                                    </label>
                                </div>
                            )}

                            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:gap-4">
                                <button onClick={fecharModal} className="flex-1 py-3.5 border border-gray-300 rounded-2xl font-medium hover:bg-gray-50 transition">Cancelar</button>
                                <button onClick={salvarProduto} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl font-medium hover:bg-indigo-700 transition">
                                    {editandoId ? 'Salvar Alterações' : 'Salvar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirmId && podeExcluir && (
                <div className="agerp-modal-overlay fixed inset-0 z-[110] flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="excluir-produto-titulo">
                    <div className="agerp-modal-panel w-full max-w-sm rounded-3xl bg-white p-5 sm:p-8">
                        <h3 id="excluir-produto-titulo" className="text-lg font-semibold">Confirmar exclusão</h3>
                        <p className="text-gray-600 mt-2 mb-8">Esta ação não pode ser desfeita.</p>
                        <div className="flex flex-col gap-3 min-[360px]:flex-row">
                            <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3.5 border border-gray-300 rounded-2xl">Cancelar</button>
                            <button onClick={executarExclusao} className="flex-1 py-3.5 bg-red-600 text-white rounded-2xl">Excluir</button>
                        </div>
                    </div>
                </div>
            )}

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

export default Produtos;
