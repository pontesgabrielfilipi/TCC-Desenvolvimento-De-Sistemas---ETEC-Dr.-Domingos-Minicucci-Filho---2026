// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { usuarioService } from '../../services/usuarioService';
import { logService } from '../../services/logService';
import type { LogSistema } from '../../services/logService';
import { adminEstatisticasService } from '../../services/adminEstatisticasService';
import type { AdminEstatisticas } from '../../services/adminEstatisticasService';
import { clienteService } from '../../services/clienteService';
import type { PerfilResponse } from '../../services/usuarioService';
import { getHttpErrorMessage } from '../../utils/httpError';
import AdminConfiguracoes from './AdminConfiguracoes';
import AdminRelatorios from './AdminRelatorios';
import { IndicatorCard } from '../../components/indicators/IndicatorCard';
import { ClientOrdersChart } from '../../components/admin/ClientOrdersChart';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Usuario {
    id: number;
    nome: string;
    email: string;
    perfilNome: string;
    ativo: boolean;
    statusAcesso?: 'PENDENTE' | 'APROVADO' | 'BLOQUEADO' | 'REJEITADO';
    status?: 'PENDENTE' | 'APROVADO' | 'BLOQUEADO' | 'REJEITADO';
    idPerfil?: number;
    dataCriacao?: string;
}

interface EdicaoUsuario {
    id: number;
    nome: string;
    email: string;
    idPerfil: number;
}

interface ClienteOpcao { id: number; nomeRazao: string }

type CampoFiltroLog = 'email' | 'perfil' | 'acao' | 'entidade' | 'ip';

interface Toast {
    id: number;
    type: 'success' | 'error';
    message: string;
}

const CORES_STATUS_PEDIDO: Record<string, string> = {
    PENDENTE: '#f59e0b',
    CONFIRMADO: '#2563eb',
    EM_PREPARACAO: '#7c3aed',
    PRONTO: '#0891b2',
    ENTREGUE: '#059669',
    CANCELADO: '#e11d48',
    EM_ANDAMENTO: '#4f46e5',
};

const CORES_PERFIS_USUARIOS = ['#2563eb', '#7c3aed', '#059669', '#f59e0b', '#e11d48', '#0891b2'];

const Admin = () => {
    const { user } = useAuth();
    const [abaAtiva, setAbaAtiva] = useState('usuarios');

    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [logs, setLogs] = useState<LogSistema[]>([]);
    const [logsCarregando, setLogsCarregando] = useState(false);
    const [logsErro, setLogsErro] = useState('');
    const [buscaLogs, setBuscaLogs] = useState('');
    const [buscaLogsAplicada, setBuscaLogsAplicada] = useState('');
    const [camposFiltroLog, setCamposFiltroLog] = useState<Record<CampoFiltroLog, boolean>>({ email: true, perfil: true, acao: true, entidade: true, ip: false });
    const [dataInicioLog, setDataInicioLog] = useState('');
    const [dataFimLog, setDataFimLog] = useState('');
    const [paginaLogs, setPaginaLogs] = useState(0);
    const [totalPaginasLogs, setTotalPaginasLogs] = useState(0);
    const [totalLogs, setTotalLogs] = useState(0);
    const [sortLogs, setSortLogs] = useState<{ key: 'dataHora' | 'acao' | 'entidade'; direction: 'asc' | 'desc' }>({ key: 'dataHora', direction: 'desc' });
    const [logDetalhado, setLogDetalhado] = useState<LogSistema | null>(null);
    const [filtrosAvancados, setFiltrosAvancados] = useState({ email: '', acao: '', resultado: '', entidade: '', recursoId: '', sessionRef: '', requestId: '', ip: '' });
    const [filtrosAplicados, setFiltrosAplicados] = useState(filtrosAvancados);
    const fecharLogRef = useRef<HTMLButtonElement>(null);
    const focoAnteriorLogRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!logDetalhado) return;
        focoAnteriorLogRef.current = document.activeElement as HTMLElement;
        fecharLogRef.current?.focus();
        const aoTeclar = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setLogDetalhado(null);
            if (event.key === 'Tab') {
                const container = fecharLogRef.current?.closest('[role="dialog"]');
                const botoes = Array.from(container?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
                if (!botoes.length) return;
                const primeiro = botoes[0]; const ultimo = botoes[botoes.length - 1];
                if (event.shiftKey && document.activeElement === primeiro) { event.preventDefault(); ultimo.focus(); }
                else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primeiro.focus(); }
            }
        };
        document.addEventListener('keydown', aoTeclar);
        return () => { document.removeEventListener('keydown', aoTeclar); focoAnteriorLogRef.current?.focus(); };
    }, [logDetalhado]);
    const [estatisticas, setEstatisticas] = useState<AdminEstatisticas | null>(null);
    const [estatisticasCarregando, setEstatisticasCarregando] = useState(false);
    const [estatisticasErro, setEstatisticasErro] = useState('');
    const [clientesOpcoes, setClientesOpcoes] = useState<ClienteOpcao[]>([]);
    const [usuariosSelecionados, setUsuariosSelecionados] = useState<number[]>([]);
    const [clientesSelecionados, setClientesSelecionados] = useState<number[]>([]);
    const [statusSelecionados, setStatusSelecionados] = useState<string[]>([]);
    const [inicioEstatisticas, setInicioEstatisticas] = useState('');
    const [fimEstatisticas, setFimEstatisticas] = useState('');
    const [paginaProdutos, setPaginaProdutos] = useState(0);
    const [paginaUsuariosEstatisticas, setPaginaUsuariosEstatisticas] = useState(0);
    const [paginaClientes, setPaginaClientes] = useState(0);
    const [paginaMovimentacoes, setPaginaMovimentacoes] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filtroStatus, setFiltroStatus] = useState('TODOS');
    const [buscaUsuarios, setBuscaUsuarios] = useState('');
    const [sortUsuarios, setSortUsuarios] = useState<{ key: 'nome' | 'email' | 'perfilNome' | 'status'; direction: 'asc' | 'desc' }>({ key: 'nome', direction: 'asc' });
    const [acaoConfirmacao, setAcaoConfirmacao] = useState<{ usuario: Usuario; acao: 'aprovar' | 'rejeitar' | 'bloquear' } | null>(null);
    const [processandoAcao, setProcessandoAcao] = useState(false);
    const [usuarioRedefinicao, setUsuarioRedefinicao] = useState<Usuario | null>(null);
    const [processandoRedefinicao, setProcessandoRedefinicao] = useState(false);
    const [credencialTemporaria, setCredencialTemporaria] = useState<{ senha: string; expiraEm: string } | null>(null);
    const [perfis, setPerfis] = useState<PerfilResponse[]>([]);
    const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
    const [formEdicao, setFormEdicao] = useState<EdicaoUsuario | null>(null);
    const [formOriginal, setFormOriginal] = useState<EdicaoUsuario | null>(null);
    const [salvandoEdicao, setSalvandoEdicao] = useState(false);
    const nomeEdicaoRef = useRef<HTMLInputElement>(null);

    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((type: 'success' | 'error', message: string) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const carregarUsuarios = useCallback(async (refresh = false) => {
        setLoading(true);
        try {
            const res = await usuarioService.listarTodos(refresh);
            setUsuarios(res.data);
            if (refresh) showToast('success', 'Usuários atualizados com sucesso.');
        } catch (error) {
            console.error(error);
            showToast('error', 'Erro ao carregar usuários');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const carregarLogs = useCallback(async (notificar = false) => {
        setLogsCarregando(true);
        setLogsErro('');
        try {
            const termo = buscaLogsAplicada.trim();
            const res = await logService.listar({
                page: paginaLogs,
                size: 20,
                search: termo || undefined,
                fields: termo ? (Object.entries(camposFiltroLog).filter(([, ativo]) => ativo).map(([campo]) => campo) as CampoFiltroLog[]) : undefined,
                dataInicio: dataInicioLog || undefined,
                dataFim: dataFimLog || undefined,
                sortBy: sortLogs.key,
                direction: sortLogs.direction,
                ...Object.fromEntries(Object.entries(filtrosAplicados).filter(([, value]) => value.trim())),
            });
            const pagina = res.data;
            setLogs(pagina.content ?? []);
            setTotalPaginasLogs(pagina.totalPages ?? 0);
            setTotalLogs(pagina.totalElements ?? 0);
            if (notificar) showToast('success', 'Logs atualizados com sucesso.');
        } catch (error) {
            console.error(error);
            setLogs([]);
            setLogsErro(getHttpErrorMessage(error, 'NÃ£o foi possÃ­vel carregar os logs de auditoria.'));
        } finally {
            setLogsCarregando(false);
        }
    }, [buscaLogsAplicada, camposFiltroLog, dataFimLog, dataInicioLog, paginaLogs, showToast, sortLogs, filtrosAplicados]);

    const ordenarLogs = (key: typeof sortLogs.key) => {
        setPaginaLogs(0);
        setSortLogs(atual => ({ key, direction: atual.key === key && atual.direction === 'asc' ? 'desc' : 'asc' }));
    };
    const indicadorLogs = (key: typeof sortLogs.key) => sortLogs.key === key ? (sortLogs.direction === 'asc' ? ' ↑' : ' ↓') : '';

    const carregarEstatisticas = useCallback(async (refresh = false) => {
        setEstatisticasCarregando(true);
        setEstatisticasErro('');
        try {
            const response = await adminEstatisticasService.obter({
                usuarioIds: usuariosSelecionados,
                clienteIds: clientesSelecionados,
                statusPedidos: statusSelecionados,
                inicio: inicioEstatisticas ? `${inicioEstatisticas}T00:00:00` : undefined,
                fim: fimEstatisticas ? `${fimEstatisticas}T23:59:59.999` : undefined,
                paginaProdutos,
                paginaUsuarios: paginaUsuariosEstatisticas,
                paginaClientes,
                paginaMovimentacoes,
                tamanhoPagina: 10,
            }, refresh);
            setEstatisticas(response.data);
            if (refresh) showToast('success', 'Estatísticas atualizadas com sucesso.');
        } catch (error) {
            setEstatisticas(null);
            setEstatisticasErro(getHttpErrorMessage(error, 'Não foi possível carregar as estatísticas.'));
        } finally {
            setEstatisticasCarregando(false);
        }
    }, [clientesSelecionados, fimEstatisticas, inicioEstatisticas, paginaClientes, paginaMovimentacoes,
        paginaProdutos, paginaUsuariosEstatisticas, showToast, statusSelecionados, usuariosSelecionados]);

    const carregarOpcoesEstatisticas = useCallback(async () => {
        try {
            const [usuariosResponse, clientesResponse] = await Promise.all([usuarioService.listarTodos(), clienteService.listar()]);
            setUsuarios(usuariosResponse.data);
            setClientesOpcoes(clientesResponse.data);
        } catch (error) {
            setEstatisticasErro(getHttpErrorMessage(error, 'Não foi possível carregar as opções dos filtros.'));
        }
    }, []);

    const abrirEdicao = async (usuario: Usuario) => {
        try {
            // Cargos podem ter sido criados/alterados na aba Configurações.
            const response = await usuarioService.listarPerfis();
            setPerfis(response.data);
            const idPerfil = usuario.idPerfil ?? response.data.find(perfil => perfil.nome === usuario.perfilNome)?.id;
            if (!idPerfil) throw new Error('Perfil atual não encontrado.');
            const form = { id: usuario.id, nome: usuario.nome, email: usuario.email, idPerfil };
            setUsuarioEditando(usuario);
            setFormEdicao(form);
            setFormOriginal(form);
            setTimeout(() => nomeEdicaoRef.current?.focus(), 0);
        } catch (error) {
            showToast('error', getHttpErrorMessage(error, 'Não foi possível carregar os perfis.'));
        }
    };

    const edicaoAlterada = Boolean(formEdicao && formOriginal && JSON.stringify(formEdicao) !== JSON.stringify(formOriginal));

    const fecharEdicao = useCallback((forcar = false) => {
        if (!forcar && edicaoAlterada && !window.confirm('Descartar as alterações não salvas?')) return;
        setUsuarioEditando(null);
        setFormEdicao(null);
        setFormOriginal(null);
    }, [edicaoAlterada]);

    useEffect(() => {
        if (!usuarioEditando) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !salvandoEdicao) fecharEdicao();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [fecharEdicao, salvandoEdicao, usuarioEditando]);

    const salvarEdicao = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!formEdicao || salvandoEdicao) return;
        const nome = formEdicao.nome.trim();
        const email = formEdicao.email.trim().toLowerCase();
        if (nome.length < 3 || nome.length > 150) {
            showToast('error', 'O nome deve ter entre 3 e 150 caracteres.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showToast('error', 'Informe um e-mail válido.');
            return;
        }
        setSalvandoEdicao(true);
        try {
            await usuarioService.atualizar(formEdicao.id, { nome, email, idPerfil: formEdicao.idPerfil });
            showToast('success', 'Usuário atualizado com sucesso.');
            fecharEdicao(true);
            await carregarUsuarios();
        } catch (error) {
            showToast('error', getHttpErrorMessage(error, 'Não foi possível atualizar o usuário.'));
        } finally {
            setSalvandoEdicao(false);
        }
    };

    useEffect(() => {
        if (abaAtiva === 'usuarios') carregarUsuarios();
        if (abaAtiva === 'logs') carregarLogs();
        if (abaAtiva === 'estatisticas') {
            carregarOpcoesEstatisticas();
            carregarEstatisticas();
        }
    }, [abaAtiva, carregarEstatisticas, carregarLogs, carregarOpcoesEstatisticas, carregarUsuarios]);

    useEffect(() => {
        if (abaAtiva !== 'estatisticas') return;
        const atualizar = () => { void carregarEstatisticas(true); };
        window.addEventListener('agerp:configuracoes-atualizadas', atualizar);
        return () => window.removeEventListener('agerp:configuracoes-atualizadas', atualizar);
    }, [abaAtiva, carregarEstatisticas]);

    const statusDoUsuario = (usuario: Usuario) => usuario.statusAcesso || usuario.status || (usuario.ativo ? 'APROVADO' : 'BLOQUEADO');

    const executarAcaoStatus = async () => {
        if (!acaoConfirmacao) return;
        setProcessandoAcao(true);
        try {
            await usuarioService[acaoConfirmacao.acao](acaoConfirmacao.usuario.id);
            const verbos = { aprovar: 'aprovado', rejeitar: 'rejeitado', bloquear: 'bloqueado' };
            showToast('success', `Usuário ${verbos[acaoConfirmacao.acao]} com sucesso.`);
            setAcaoConfirmacao(null);
            await carregarUsuarios();
        } catch (error) {
            console.error(error);
            showToast('error', 'Não foi possível concluir a ação. Verifique as regras administrativas.');
        } finally {
            setProcessandoAcao(false);
        }
    };

    const fecharRedefinicao = () => {
        setUsuarioRedefinicao(null);
        setCredencialTemporaria(null);
    };

    const executarRedefinicao = async () => {
        if (!usuarioRedefinicao) return;
        setProcessandoRedefinicao(true);
        try {
            const response = await usuarioService.redefinirSenha(usuarioRedefinicao.id);
            setCredencialTemporaria({ senha: response.data.senhaTemporaria, expiraEm: response.data.expiraEm });
            showToast('success', 'Credencial temporária criada. Ela será exibida somente agora.');
        } catch (error) {
            const mensagem = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
            showToast('error', mensagem || 'Não foi possível redefinir a senha deste usuário.');
        } finally {
            setProcessandoRedefinicao(false);
        }
    };

    const usuariosFiltrados = useMemo(() => {
        const termo = buscaUsuarios.trim().toLocaleLowerCase('pt-BR');
        const filtrados = usuarios.filter(usuario =>
            (filtroStatus === 'TODOS' || statusDoUsuario(usuario) === filtroStatus) &&
            (!termo || [usuario.id, usuario.nome, usuario.email, usuario.perfilNome, statusDoUsuario(usuario)]
                .some(valor => String(valor ?? '').toLocaleLowerCase('pt-BR').includes(termo)))
        );
        return [...filtrados].sort((a, b) => {
            const av = sortUsuarios.key === 'status' ? statusDoUsuario(a) : a[sortUsuarios.key] ?? '';
            const bv = sortUsuarios.key === 'status' ? statusDoUsuario(b) : b[sortUsuarios.key] ?? '';
            const resultado = String(av).localeCompare(String(bv), 'pt-BR', { numeric: true, sensitivity: 'base' });
            return sortUsuarios.direction === 'asc' ? resultado : -resultado;
        });
    }, [buscaUsuarios, filtroStatus, sortUsuarios, usuarios]);

    const ordenarUsuarios = (key: typeof sortUsuarios.key) => setSortUsuarios(atual => ({
        key,
        direction: atual.key === key && atual.direction === 'asc' ? 'desc' : 'asc'
    }));
    const indicadorUsuarios = (key: typeof sortUsuarios.key) => sortUsuarios.key === key ? (sortUsuarios.direction === 'asc' ? ' ↑' : ' ↓') : '';

    const pesquisarLogs = (event: React.FormEvent) => {
        event.preventDefault();
        if (!Object.values(camposFiltroLog).some(Boolean) && buscaLogs.trim()) {
            showToast('error', 'Selecione pelo menos um campo para pesquisar.');
            return;
        }
        setPaginaLogs(0);
        setBuscaLogsAplicada(buscaLogs);
        setFiltrosAplicados({ ...filtrosAvancados });
    };

    const limparFiltrosLogs = () => {
        setBuscaLogs('');
        setBuscaLogsAplicada('');
        setDataInicioLog('');
        setDataFimLog('');
        setFiltrosAvancados({ email: '', acao: '', resultado: '', entidade: '', recursoId: '', sessionRef: '', requestId: '', ip: '' });
        setFiltrosAplicados({ email: '', acao: '', resultado: '', entidade: '', recursoId: '', sessionRef: '', requestId: '', ip: '' });
        setCamposFiltroLog({ email: true, perfil: true, acao: true, entidade: true, ip: false });
        setPaginaLogs(0);
    };

    const valorLog = (log: LogSistema, atual: keyof LogSistema, legado?: keyof LogSistema) =>
        String(log[atual] ?? (legado ? log[legado] : '') ?? '').trim() || '—';

    const alternarSelecao = <T extends string | number>(valor: T, selecionados: T[], atualizar: (valores: T[]) => void) =>
        atualizar(selecionados.includes(valor) ? selecionados.filter(item => item !== valor) : [...selecionados, valor]);

    const reiniciarPaginasEstatisticas = () => {
        setPaginaProdutos(0);
        setPaginaUsuariosEstatisticas(0);
        setPaginaClientes(0);
        setPaginaMovimentacoes(0);
    };

    const alternarFiltroEstatisticas = <T extends string | number>(valor: T, selecionados: T[], atualizar: (valores: T[]) => void) => {
        alternarSelecao(valor, selecionados, atualizar);
        reiniciarPaginasEstatisticas();
    };

    const limparFiltrosEstatisticas = () => {
        setUsuariosSelecionados([]);
        setClientesSelecionados([]);
        setStatusSelecionados([]);
        setInicioEstatisticas('');
        setFimEstatisticas('');
        reiniciarPaginasEstatisticas();
    };

    const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const abas = [
        { id: 'usuarios', label: 'Gerenciar Usuários', icon: '👥' },
        { id: 'logs', label: 'Logs do Sistema', icon: '📜' },
        { id: 'estatisticas', label: 'Estatísticas', icon: '📊' },
        { id: 'configuracoes', label: 'Configurações', icon: '⚙️' },
        { id: 'relatorios', label: 'Relatórios', icon: '📈' },
    ];

    return (
        <div className="flex h-full min-w-0 bg-app-background">
            <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
                <header className="hidden items-center gap-3 border-b bg-white px-4 py-4 sm:flex sm:px-8 sm:py-5">
                    <span className="text-2xl sm:text-3xl" aria-hidden="true">🔧</span>
                    <h1 className="min-w-0 text-xl font-semibold text-gray-800 sm:text-2xl">Painel Administrativo</h1>
                </header>

                <div className="min-w-0 p-3 sm:p-6 xl:p-8 flex-1 overflow-y-auto overflow-x-hidden">
                    <div className="flex border-b mb-6 overflow-x-auto max-w-full" role="group" aria-label="Seções administrativas">
                        {abas.map(aba => (
                            <button
                                key={aba.id}
                                onClick={() => setAbaAtiva(aba.id)}
                                aria-pressed={abaAtiva === aba.id}
                                className={`flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-medium transition sm:px-8 sm:py-4 ${
                                    abaAtiva === aba.id
                                        ? 'border-indigo-600 text-indigo-600'
                                        : 'border-transparent hover:text-gray-700'
                                }`}
                            >
                                {aba.icon} {aba.label}
                            </button>
                        ))}
                    </div>

                    {abaAtiva === 'usuarios' && (
                        <div>
                            <div className="mb-6 grid grid-cols-1 items-center gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_18rem_auto_auto]">
                                <h2 className="text-xl font-semibold sm:col-span-2 xl:col-span-1">Gerenciamento de Usuários</h2>
                                <input value={buscaUsuarios} onChange={event => setBuscaUsuarios(event.target.value)} placeholder="Pesquisar nome, e-mail, perfil ou ID" aria-label="Pesquisar usuários" className="min-h-11 min-w-0 rounded-xl border border-gray-300 px-4 py-2" />
                                <button onClick={() => void carregarUsuarios(true)} disabled={loading} className="min-h-11 rounded-xl border border-gray-300 px-4 py-2 font-medium disabled:opacity-50">{loading ? 'Atualizando...' : '↻ Atualizar'}</button>
                                <label className="flex min-w-0 items-center gap-2 text-sm text-gray-700">
                                    Status
                                    <select value={filtroStatus} onChange={event => setFiltroStatus(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2">
                                        <option value="TODOS">Todos</option>
                                        <option value="PENDENTE">Pendentes</option>
                                        <option value="APROVADO">Aprovados</option>
                                        <option value="BLOQUEADO">Bloqueados</option>
                                        <option value="REJEITADO">Rejeitados</option>
                                    </select>
                                </label>
                            </div>
                            {loading ? (
                                <div className="text-center py-16 text-gray-500 font-medium">Carregando painel de usuários...</div>
                            ) : (<>
                                <div className="mb-3 flex items-center gap-2 md:hidden">
                                    <label htmlFor="ordenacao-usuarios-mobile" className="shrink-0 text-sm font-medium text-gray-600">Ordenar:</label>
                                    <select id="ordenacao-usuarios-mobile" value={sortUsuarios.key} onChange={event => setSortUsuarios(atual => ({ ...atual, key: event.target.value as typeof sortUsuarios.key }))} className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"><option value="nome">Nome</option><option value="email">E-mail</option><option value="perfilNome">Perfil</option><option value="status">Status</option></select>
                                    <button type="button" onClick={() => setSortUsuarios(atual => ({ ...atual, direction: atual.direction === 'asc' ? 'desc' : 'asc' }))} className="min-h-11 min-w-11 rounded-xl border border-gray-300 bg-white" aria-label={`Ordem ${sortUsuarios.direction === 'asc' ? 'crescente' : 'decrescente'}; alternar direção`}>{sortUsuarios.direction === 'asc' ? '↑' : '↓'}</button>
                                </div>
                                <div className="grid gap-3 md:hidden" aria-label="Lista de usuários">
                                    {usuariosFiltrados.map(u => { const status = statusDoUsuario(u); const badge = status === 'APROVADO' ? 'bg-green-100 text-green-700' : status === 'PENDENTE' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'; return <article key={u.id} className="agerp-mobile-card rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                                        <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold text-gray-900">{u.nome}</h3><p className="mt-1 break-all text-sm text-gray-600">{u.email}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${badge}`}>{status}</span></div>
                                        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs uppercase text-gray-500">ID</dt><dd>{u.id}</dd></div><div><dt className="text-xs uppercase text-gray-500">Perfil</dt><dd className="break-words">{u.perfilNome || '—'}</dd></div></dl>
                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                            <button onClick={() => abrirEdicao(u)} className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">Editar</button>
                                            {status !== 'APROVADO' && <button onClick={() => setAcaoConfirmacao({ usuario: u, acao: 'aprovar' })} className="rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-700">Aprovar</button>}
                                            {status === 'PENDENTE' && <button onClick={() => setAcaoConfirmacao({ usuario: u, acao: 'rejeitar' })} className="rounded-xl bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700">Rejeitar</button>}
                                            {status === 'APROVADO' && <button onClick={() => setAcaoConfirmacao({ usuario: u, acao: 'bloquear' })} className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">Bloquear</button>}
                                            {u.id !== user?.id && <button onClick={() => { setUsuarioRedefinicao(u); setCredencialTemporaria(null); }} className="col-span-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700">Redefinir senha</button>}
                                        </div>
                                    </article>; })}
                                    {usuariosFiltrados.length === 0 && <div className="rounded-3xl bg-white p-8 text-center text-gray-500">Nenhum usuário neste status.</div>}
                                </div>
                                <div className="hidden rounded-3xl bg-white shadow-sm md:block md:overflow-x-auto" role="region" aria-label="Tabela de usuários" tabIndex={0}>
                                <table className="w-full min-w-[760px]">
                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left"><button onClick={() => ordenarUsuarios('nome')}>Nome{indicadorUsuarios('nome')}</button></th>
                                        <th className="px-6 py-4 text-left"><button onClick={() => ordenarUsuarios('email')}>E-mail{indicadorUsuarios('email')}</button></th>
                                        <th className="px-6 py-4 text-left"><button onClick={() => ordenarUsuarios('perfilNome')}>Perfil{indicadorUsuarios('perfilNome')}</button></th>
                                        <th className="px-6 py-4 text-left"><button onClick={() => ordenarUsuarios('status')}>Status{indicadorUsuarios('status')}</button></th>
                                        <th className="px-6 py-4 text-center">Ações</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                    {usuariosFiltrados.map((u) => {
                                        const status = statusDoUsuario(u);
                                        const badge = status === 'APROVADO' ? 'bg-green-100 text-green-700' : status === 'PENDENTE' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700';
                                        return (
                                        <tr key={u.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">{u.nome}</td>
                                            <td className="px-6 py-4">{u.email}</td>
                                            <td className="px-6 py-4">{u.perfilNome || '—'}</td>
                                            <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${badge}`}>
                                                        {status}
                                                    </span>
                                            </td>
                                            <td className="px-6 py-4 text-center space-x-3">
                                                <button onClick={() => abrirEdicao(u)} className="text-blue-700 hover:text-blue-900 font-medium">Editar</button>
                                                {status !== 'APROVADO' && <button onClick={() => setAcaoConfirmacao({ usuario: u, acao: 'aprovar' })} className="text-green-700 hover:text-green-900 font-medium">Aprovar</button>}
                                                {status === 'PENDENTE' && <button onClick={() => setAcaoConfirmacao({ usuario: u, acao: 'rejeitar' })} className="text-orange-700 hover:text-orange-900 font-medium">Rejeitar</button>}
                                                {status === 'APROVADO' && <button onClick={() => setAcaoConfirmacao({ usuario: u, acao: 'bloquear' })} className="text-red-600 hover:text-red-800 font-medium">Bloquear</button>}
                                                {u.id !== user?.id && <button onClick={() => { setUsuarioRedefinicao(u); setCredencialTemporaria(null); }} className="text-indigo-600 hover:text-indigo-800 font-medium">Redefinir senha</button>}
                                            </td>
                                        </tr>
                                    )})}
                                    {usuariosFiltrados.length === 0 && (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Nenhum usuário neste status.</td></tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>
                            </>)}
                        </div>
                    )}

                    {abaAtiva === 'logs' && (
                        <div>
                            <div className="mb-6">
                                <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Auditoria do Sistema</h2><button onClick={() => void carregarLogs(true)} disabled={logsCarregando} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50">{logsCarregando ? 'Atualizando...' : '↻ Atualizar'}</button></div>
                                <p className="text-sm text-gray-700 mt-1">{totalLogs} evento{totalLogs === 1 ? '' : 's'} encontrado{totalLogs === 1 ? '' : 's'}</p>
                            </div>
                            <form onSubmit={pesquisarLogs} className="mb-5 rounded-3xl bg-white p-4 shadow-sm sm:p-5" aria-label="Filtros de auditoria">
                                <p className="mb-3 text-xs text-gray-600">Filtros combinados por E; busca textual em qualquer campo selecionado. Horários exibidos em America/Sao_Paulo (UTC−03:00).</p>
                                <div className="flex flex-col lg:flex-row gap-3">
                                    <label className="flex-1"><span className="sr-only">Termo de pesquisa</span><input value={buscaLogs} onChange={event => setBuscaLogs(event.target.value)} placeholder="Pesquisar nos campos selecionados" className="w-full rounded-xl border border-gray-300 px-4 py-3" /></label>
                                    <label className="text-sm text-gray-700"><span className="block mb-1">Data inicial</span><input type="date" value={dataInicioLog} max={dataFimLog || undefined} onChange={event => { setDataInicioLog(event.target.value); setPaginaLogs(0); }} className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2" /></label>
                                    <label className="text-sm text-gray-700"><span className="block mb-1">Data final</span><input type="date" value={dataFimLog} min={dataInicioLog || undefined} onChange={event => { setDataFimLog(event.target.value); setPaginaLogs(0); }} className="min-h-11 w-full rounded-xl border border-gray-300 px-3 py-2" /></label>
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    {([['email', 'E-mail do ator'], ['acao', 'Ação exata'], ['resultado', 'Resultado'], ['entidade', 'Entidade'], ['recursoId', 'ID do recurso'], ['sessionRef', 'Sessão (referência)'], ['requestId', 'Request UUID'], ['ip', 'IP exato']] as const).map(([campo, rotulo]) => <label key={campo} className="min-w-0 text-sm text-gray-700"><span className="mb-1 block">{rotulo}</span><input className="min-h-11 w-full min-w-0 rounded-xl border border-gray-300 px-3 py-2" value={filtrosAvancados[campo]} onChange={event => setFiltrosAvancados(atual => ({ ...atual, [campo]: event.target.value }))} /></label>)}
                                </div>
                                <fieldset className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                                    <legend className="sr-only">Campos pesquisados</legend>
                                    {([['email', 'E-mail'], ['perfil', 'Cargo/Perfil'], ['acao', 'Ação'], ['entidade', 'Entidade'], ['ip', 'IP']] as const).map(([campo, rotulo]) => (
                                        <label key={campo} className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={camposFiltroLog[campo]} onChange={() => { setCamposFiltroLog(atuais => ({ ...atuais, [campo]: !atuais[campo] })); setPaginaLogs(0); }} className="h-4 w-4 rounded border-gray-300" />{rotulo}</label>
                                    ))}
                                    <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
                                        <button type="button" onClick={limparFiltrosLogs} className="min-h-11 rounded-xl border border-gray-300 px-4 py-2 text-sm">Limpar</button>
                                        <button type="submit" className="min-h-11 rounded-xl bg-indigo-600 px-5 py-2 text-sm text-white">Pesquisar</button>
                                    </div>
                                </fieldset>
                            </form>
                            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                                <div className="border-b border-gray-100 p-3 md:hidden">
                                    <div className="flex items-center gap-2"><label htmlFor="ordenacao-logs-mobile" className="shrink-0 text-sm font-medium text-gray-600">Ordenar:</label><select id="ordenacao-logs-mobile" value={sortLogs.key} onChange={event => setSortLogs(atual => ({ ...atual, key: event.target.value as typeof sortLogs.key }))} className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm"><option value="dataHora">Data/Hora</option><option value="acao">Ação</option><option value="entidade">Entidade</option></select><button type="button" onClick={() => setSortLogs(atual => ({ ...atual, direction: atual.direction === 'asc' ? 'desc' : 'asc' }))} className="min-h-11 min-w-11 rounded-xl border border-gray-300" aria-label={`Ordem ${sortLogs.direction === 'asc' ? 'crescente' : 'decrescente'}; alternar direção`}>{sortLogs.direction === 'asc' ? '↑' : '↓'}</button></div>
                                </div>
                                <div className="grid gap-3 p-3 md:hidden" aria-label="Eventos de auditoria">
                                    {logsCarregando ? <p className="py-10 text-center text-gray-500">Carregando eventos de auditoria...</p> : logsErro ? <div className="py-8 text-center"><p className="text-red-700">{logsErro}</p><button onClick={() => void carregarLogs()} className="mt-3 min-h-11 rounded-xl px-4 font-medium text-indigo-700">Tentar novamente</button></div> : logs.length === 0 ? <p className="py-10 text-center text-gray-500">Nenhum evento encontrado para os filtros informados.</p> : logs.map(log => <article key={log.id} className="agerp-mobile-card rounded-2xl border border-gray-100 p-4">
                                        <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold text-gray-900">{log.acao}</h3><p className="mt-1 text-xs text-gray-500">{new Date(log.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (SP)</p></div><button onClick={() => setLogDetalhado(log)} className="min-h-11 shrink-0 rounded-xl bg-indigo-50 px-3 text-sm font-medium text-indigo-700">Ver detalhes</button></div>
                                        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div className="col-span-2"><dt className="text-xs uppercase text-gray-500">Usuário</dt><dd className="break-words">{valorLog(log, 'nomeUsuario', 'usuarioNome')}</dd></div><div className="col-span-2"><dt className="text-xs uppercase text-gray-500">E-mail</dt><dd className="break-all">{valorLog(log, 'emailUsuario', 'usuarioEmail')}</dd></div><div className="min-w-0"><dt className="text-xs uppercase text-gray-500">Cargo/Perfil</dt><dd className="break-words">{valorLog(log, 'perfilUsuario', 'usuarioPerfil')}</dd></div><div className="min-w-0"><dt className="text-xs uppercase text-gray-500">Entidade</dt><dd className="break-words">{log.entidade}</dd></div><div className="col-span-2"><dt className="text-xs uppercase text-gray-500">IP</dt><dd className="break-all font-mono">{log.ip || '—'}</dd></div></dl>
                                    </article>)}
                                </div>
                                <div className="hidden overflow-x-auto md:block" role="region" aria-label="Tabela de auditoria" tabIndex={0}>
                                <table className="w-full min-w-[1050px]">
                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left"><button onClick={() => ordenarLogs('dataHora')}>Data/Hora{indicadorLogs('dataHora')}</button></th>
                                        <th className="px-6 py-4 text-left"><button onClick={() => ordenarLogs('acao')}>Ação{indicadorLogs('acao')}</button></th>
                                        <th className="px-6 py-4 text-left">Usuário</th>
                                        <th className="px-6 py-4 text-left">E-mail</th>
                                        <th className="px-6 py-4 text-left">Cargo/Perfil</th>
                                        <th className="px-6 py-4 text-left"><button onClick={() => ordenarLogs('entidade')}>Entidade{indicadorLogs('entidade')}</button></th>
                                        <th className="px-6 py-4 text-left">IP</th>
                                        <th className="px-6 py-4 text-right">Detalhes</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                    {logsCarregando ? (
                                        <tr><td colSpan={8} className="px-6 py-16 text-center text-gray-500">Carregando eventos de auditoria...</td></tr>
                                    ) : logsErro ? (
                                        <tr><td colSpan={8} className="px-6 py-12 text-center"><p className="text-red-700">{logsErro}</p><button onClick={() => void carregarLogs()} className="mt-3 text-indigo-700 font-medium">Tentar novamente</button></td></tr>
                                    ) : logs.length === 0 ? (
                                        <tr><td colSpan={8} className="px-6 py-16 text-center text-gray-500">Nenhum evento encontrado para os filtros informados.</td></tr>
                                    ) : logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50 align-top">
                                            <td className="px-6 py-4 whitespace-nowrap">{new Date(log.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (SP)</td>
                                            <td className="px-6 py-4">{log.acao}</td>
                                            <td className="px-6 py-4">{valorLog(log, 'nomeUsuario', 'usuarioNome')}</td>
                                            <td className="px-6 py-4">{valorLog(log, 'emailUsuario', 'usuarioEmail')}</td>
                                            <td className="px-6 py-4">{valorLog(log, 'perfilUsuario', 'usuarioPerfil')}</td>
                                            <td className="px-6 py-4">{log.entidade}</td>
                                            <td className="px-6 py-4 font-mono text-sm">{log.ip || '—'}</td>
                                            <td className="px-6 py-4 text-right"><button onClick={() => setLogDetalhado(log)} className="text-indigo-700 hover:text-indigo-900 font-medium">Ver</button></td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                </div>
                                {!logsCarregando && !logsErro && totalPaginasLogs > 0 && (
                                    <div className="border-t px-5 py-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                                        <span className="text-gray-600">Página {paginaLogs + 1} de {totalPaginasLogs}</span>
                                        <div className="flex gap-2"><button disabled={paginaLogs === 0} onClick={() => setPaginaLogs(atual => Math.max(0, atual - 1))} className="rounded-xl border border-gray-300 px-4 py-2 disabled:opacity-40">Anterior</button><button disabled={paginaLogs + 1 >= totalPaginasLogs} onClick={() => setPaginaLogs(atual => atual + 1)} className="rounded-xl border border-gray-300 px-4 py-2 disabled:opacity-40">Próxima</button></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {abaAtiva === 'estatisticas' && (
                        <div className="space-y-6">
                            <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                                <div><h2 className="text-xl font-semibold">Estatísticas administrativas</h2><p className="text-sm text-gray-500 mt-1">Indicadores calculados a partir dos dados reais do período.</p></div>
                                <div className="grid grid-cols-2 gap-2"><button onClick={limparFiltrosEstatisticas} className="min-h-11 rounded-xl border border-gray-300 px-4 py-2 text-sm">Limpar filtros</button><button onClick={() => void carregarEstatisticas(true)} disabled={estatisticasCarregando} className="min-h-11 rounded-xl bg-indigo-600 px-5 py-2 text-sm text-white disabled:opacity-50">Atualizar</button></div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 rounded-3xl bg-white p-4 shadow-sm sm:p-5 md:grid-cols-2 xl:grid-cols-5">
                                <label className="text-sm text-gray-700"><span className="block mb-1">Data inicial</span><input type="date" value={inicioEstatisticas} max={fimEstatisticas || undefined} onChange={event => { setInicioEstatisticas(event.target.value); reiniciarPaginasEstatisticas(); }} className="w-full rounded-xl border border-gray-300 px-3 py-2" /></label>
                                <label className="text-sm text-gray-700"><span className="block mb-1">Data final</span><input type="date" value={fimEstatisticas} min={inicioEstatisticas || undefined} onChange={event => { setFimEstatisticas(event.target.value); reiniciarPaginasEstatisticas(); }} className="w-full rounded-xl border border-gray-300 px-3 py-2" /></label>
                                <details className="relative"><summary className="flex min-h-11 cursor-pointer items-center rounded-xl border border-gray-300 px-4 py-2.5 text-sm list-none">Usuários ({usuariosSelecionados.length || 'todos'})</summary><div className="z-20 mt-2 max-h-64 w-full min-w-0 space-y-2 overflow-auto rounded-xl border bg-white p-3 shadow-xl md:absolute md:left-0 md:w-72">{usuarios.map(item => <label key={item.id} className="flex min-w-0 gap-2 text-sm"><input type="checkbox" checked={usuariosSelecionados.includes(item.id)} onChange={() => alternarFiltroEstatisticas(item.id, usuariosSelecionados, setUsuariosSelecionados)} /><span className="min-w-0 break-words">{item.nome} <span className="break-all text-gray-500">({item.email})</span></span></label>)}</div></details>
                                <details className="relative"><summary className="flex min-h-11 cursor-pointer items-center rounded-xl border border-gray-300 px-4 py-2.5 text-sm list-none">Clientes ({clientesSelecionados.length || 'todos'})</summary><div className="z-20 mt-2 max-h-64 w-full min-w-0 space-y-2 overflow-auto rounded-xl border bg-white p-3 shadow-xl md:absolute md:left-0 md:w-72">{clientesOpcoes.length ? clientesOpcoes.map(item => <label key={item.id} className="flex min-w-0 gap-2 break-words text-sm"><input type="checkbox" checked={clientesSelecionados.includes(item.id)} onChange={() => alternarFiltroEstatisticas(item.id, clientesSelecionados, setClientesSelecionados)} />{item.nomeRazao}</label>) : <p className="text-sm text-gray-500">Nenhum cliente disponível.</p>}</div></details>
                                <details className="relative"><summary className="flex min-h-11 cursor-pointer items-center rounded-xl border border-gray-300 px-4 py-2.5 text-sm list-none">Status ({statusSelecionados.length || 'todos'})</summary><div className="z-20 mt-2 max-h-64 w-full min-w-0 space-y-2 overflow-auto rounded-xl border bg-white p-3 shadow-xl md:absolute md:right-0 md:w-64">{estatisticas?.filtrosDisponiveis.statusPedidos?.map(status => <label key={status} className="flex gap-2 text-sm"><input type="checkbox" checked={statusSelecionados.includes(status)} onChange={() => alternarFiltroEstatisticas(status, statusSelecionados, setStatusSelecionados)} />{status}</label>) ?? <p className="text-sm text-gray-500">Carregando opções...</p>}</div></details>
                                <label className="md:col-span-2 xl:col-span-5 text-sm text-gray-500"><span className="block mb-1">Categoria/Tipo de produto</span><input disabled value="Filtro indisponível" className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-2 text-gray-500" /><span className="block mt-1 text-xs">{estatisticas?.metadados.categoriaProduto || 'O schema atual não possui categoria de produto.'}</span></label>
                            </div>

                            {estatisticas && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 space-y-1"><p>Totais cadastrais de usuários, clientes, produtos e estoque são globais e não variam com os filtros transacionais.</p><p>Movimentações por usuário respeitam usuário e período; cliente e status do pedido não se aplicam a essa métrica.</p></div>}

                            {estatisticasCarregando ? <div className="bg-white rounded-3xl py-20 text-center text-gray-500">Carregando estatísticas...</div> : estatisticasErro ? <div className="bg-white rounded-3xl py-16 text-center"><p className="text-red-700">{estatisticasErro}</p><button onClick={() => void carregarEstatisticas()} className="mt-3 text-indigo-700 font-medium">Tentar novamente</button></div> : !estatisticas ? <div className="bg-white rounded-3xl py-20 text-center text-gray-500">Nenhum dado disponível.</div> : (
                                <>
                                    <div className="agerp-indicator-grid">
                                        {[['Usuários', estatisticas.usuarios.total], ['Clientes', estatisticas.clientes.total], ['Pedidos', estatisticas.pedidos.total], ['Faturamento', moeda(estatisticas.pedidos.faturamento)], ['Ticket médio', moeda(estatisticas.pedidos.ticketMedio)], ['Estoque baixo', estatisticas.produtos.estoqueBaixo]].map(([rotulo, valor]) => <IndicatorCard key={rotulo} label={String(rotulo)} value={valor} />)}
                                    </div>
                                    <div className="agerp-indicator-grid">
                                        {[['Usuários ativos', estatisticas.usuarios.ativos], ['Usuários pendentes', estatisticas.usuarios.pendentes], ['Usuários bloqueados', estatisticas.usuarios.bloqueados], ['Clientes com pedidos', estatisticas.clientes.comPedidos], ['Produtos', estatisticas.produtos.total], ['Quantidade vendida', estatisticas.produtos.quantidadeVendida], ['Valor vendido', moeda(estatisticas.produtos.valorVendido)], ['Estoque disponível', estatisticas.produtos.estoqueDisponivel], ['Pedidos pendentes', estatisticas.pedidos.pendentes], ['Pedidos em andamento', estatisticas.pedidos.emAndamento], ['Pedidos concluídos', estatisticas.pedidos.concluidos], ['Pedidos cancelados', estatisticas.pedidos.cancelados]].map(([rotulo, valor]) => <IndicatorCard key={rotulo} label={String(rotulo)} value={valor} variant="secondary" />)}
                                    </div>
                                    {estatisticas.pedidos.total === 0 && estatisticas.clientes.evolucao.length === 0 && estatisticas.usuarios.movimentacoes.totalElementos === 0 ? <div className="bg-white rounded-3xl py-14 text-center text-gray-500">Não há dados transacionais para os filtros selecionados.</div> : (
                                        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
                                            <div className="min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-5"><h3 className="mb-4 font-semibold">Evolução de pedidos</h3><div className="agerp-responsive-chart h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={estatisticas.pedidos.evolucaoMensal} margin={{ left: -12, right: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="periodo" /><YAxis /><Tooltip formatter={(value) => moeda(Number(value))} /><Legend /><Line type="monotone" dataKey="valor" name="Faturamento" stroke="#4f46e5" /><Line type="monotone" dataKey="quantidade" name="Pedidos" stroke="#059669" /></LineChart></ResponsiveContainer></div></div>
                                            <div className="min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-5"><h3 className="mb-4 font-semibold">Pedidos por status</h3><div className="agerp-responsive-chart h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={estatisticas.pedidos.distribuicaoStatus} dataKey="quantidade" nameKey="nome" outerRadius="75%">{estatisticas.pedidos.distribuicaoStatus.map(item => <Cell key={item.nome} fill={CORES_STATUS_PEDIDO[item.nome] ?? '#64748b'} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div></div>
                                            <div className="min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-5"><h3 className="mb-4 font-semibold">Perfis de usuários</h3><div className="agerp-responsive-chart h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={estatisticas.usuarios.distribuicaoPerfis} margin={{ left: -12, right: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="nome" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="quantidade" name="Usuários">{estatisticas.usuarios.distribuicaoPerfis.map((item, index) => <Cell key={item.nome} fill={CORES_PERFIS_USUARIOS[index % CORES_PERFIS_USUARIOS.length]} />)}</Bar></BarChart></ResponsiveContainer></div></div>
                                            <div className="bg-white rounded-3xl shadow-sm p-5 overflow-hidden"><h3 className="font-semibold mb-4">Produtos mais vendidos</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-3">Produto</th><th className="text-right">Quantidade</th><th className="text-right">Valor</th></tr></thead><tbody>{estatisticas.produtos.topVendidos.conteudo.map(item => <tr key={item.id} className="border-b last:border-0"><td className="py-3">{item.nome}</td><td className="text-right">{item.quantidade}</td><td className="text-right">{moeda(item.valor)}</td></tr>)}{!estatisticas.produtos.topVendidos.conteudo.length && <tr><td colSpan={3} className="py-10 text-center text-gray-500">Sem vendas no período.</td></tr>}</tbody></table></div>{estatisticas.produtos.topVendidos.totalPaginas > 1 && <div className="mt-4 flex items-center justify-between text-sm"><span>Página {estatisticas.produtos.topVendidos.pagina + 1} de {estatisticas.produtos.topVendidos.totalPaginas}</span><div className="flex gap-2"><button disabled={paginaProdutos === 0} onClick={() => setPaginaProdutos(atual => Math.max(0, atual - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Anterior</button><button disabled={paginaProdutos + 1 >= estatisticas.produtos.topVendidos.totalPaginas} onClick={() => setPaginaProdutos(atual => atual + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Próxima</button></div></div>}</div>
                                            <div className="bg-white rounded-3xl shadow-sm p-5 xl:col-span-2 overflow-hidden"><h3 className="font-semibold mb-4">Desempenho por usuário</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-3">Usuário</th><th className="text-right">Pedidos</th><th className="text-right">Faturamento</th></tr></thead><tbody>{estatisticas.usuarios.desempenho.conteudo.map(item => <tr key={item.id} className="border-b last:border-0"><td className="py-3">{item.nome}</td><td className="text-right">{item.pedidos}</td><td className="text-right">{moeda(item.faturamento)}</td></tr>)}{!estatisticas.usuarios.desempenho.conteudo.length && <tr><td colSpan={3} className="py-10 text-center text-gray-500">Sem desempenho no período.</td></tr>}</tbody></table></div>{estatisticas.usuarios.desempenho.totalPaginas > 1 && <div className="mt-4 flex items-center justify-between text-sm"><span>Página {estatisticas.usuarios.desempenho.pagina + 1} de {estatisticas.usuarios.desempenho.totalPaginas}</span><div className="flex gap-2"><button disabled={paginaUsuariosEstatisticas === 0} onClick={() => setPaginaUsuariosEstatisticas(atual => Math.max(0, atual - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Anterior</button><button disabled={paginaUsuariosEstatisticas + 1 >= estatisticas.usuarios.desempenho.totalPaginas} onClick={() => setPaginaUsuariosEstatisticas(atual => atual + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Próxima</button></div></div>}</div>
                                            <section aria-labelledby="evolucao-clientes-titulo" className="min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-5"><h3 id="evolucao-clientes-titulo" className="mb-4 font-semibold">Evolução de pedidos por cliente</h3><ClientOrdersChart evolucao={estatisticas.clientes.evolucao} /></section>
                                            <section aria-labelledby="movimentacoes-usuarios-titulo" className="min-w-0 rounded-3xl bg-white p-4 shadow-sm xl:col-span-2 sm:p-5"><h3 id="movimentacoes-usuarios-titulo" className="mb-4 font-semibold">Movimentações de estoque por usuário</h3><div className="max-w-full overflow-x-auto" role="region" aria-label="Tabela de movimentações de estoque por usuário" tabIndex={0}><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b"><th scope="col" className="min-w-[180px] px-4 py-3 text-left">Usuário</th><th scope="col" className="whitespace-nowrap px-4 py-3 text-right">Movimentações</th><th scope="col" className="whitespace-nowrap px-4 py-3 text-right">Entradas</th><th scope="col" className="whitespace-nowrap px-4 py-3 text-right">Saídas</th></tr></thead><tbody>{estatisticas.usuarios.movimentacoes.conteudo.map(item => <tr key={item.id} className="border-b last:border-0"><td className="break-words px-4 py-3 [overflow-wrap:anywhere]">{item.nome}</td><td className="whitespace-nowrap px-4 py-3 text-right">{item.movimentacoes}</td><td className="whitespace-nowrap px-4 py-3 text-right">{item.quantidadeEntrada}</td><td className="whitespace-nowrap px-4 py-3 text-right">{item.quantidadeSaida}</td></tr>)}{!estatisticas.usuarios.movimentacoes.conteudo.length && <tr><td colSpan={4} className="py-10 text-center text-gray-500">Sem movimentações no período.</td></tr>}</tbody></table></div>{estatisticas.usuarios.movimentacoes.totalPaginas > 1 && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm"><span>Página {estatisticas.usuarios.movimentacoes.pagina + 1} de {estatisticas.usuarios.movimentacoes.totalPaginas}</span><div className="flex gap-2"><button disabled={paginaMovimentacoes === 0} onClick={() => setPaginaMovimentacoes(atual => Math.max(0, atual - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Anterior</button><button disabled={paginaMovimentacoes + 1 >= estatisticas.usuarios.movimentacoes.totalPaginas} onClick={() => setPaginaMovimentacoes(atual => atual + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Próxima</button></div></div>}</section>
                                            <div className="bg-white rounded-3xl shadow-sm p-5 overflow-hidden"><h3 className="font-semibold mb-4">Clientes mais frequentes</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-3">Cliente</th><th className="text-right">Pedidos</th><th className="text-right">Faturamento</th></tr></thead><tbody>{estatisticas.clientes.topFrequentes.conteudo.map(item => <tr key={item.id} className="border-b last:border-0"><td className="py-3">{item.nome}</td><td className="text-right">{item.pedidos}</td><td className="text-right">{moeda(item.faturamento)}</td></tr>)}{!estatisticas.clientes.topFrequentes.conteudo.length && <tr><td colSpan={3} className="py-10 text-center text-gray-500">Sem clientes no período.</td></tr>}</tbody></table></div>{estatisticas.clientes.topFrequentes.totalPaginas > 1 && <div className="mt-4 flex items-center justify-between text-sm"><span>Página {estatisticas.clientes.topFrequentes.pagina + 1} de {estatisticas.clientes.topFrequentes.totalPaginas}</span><div className="flex gap-2"><button disabled={paginaClientes === 0} onClick={() => setPaginaClientes(atual => Math.max(0, atual - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Anterior</button><button disabled={paginaClientes + 1 >= estatisticas.clientes.topFrequentes.totalPaginas} onClick={() => setPaginaClientes(atual => atual + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Próxima</button></div></div>}</div>
                                        </div>
                                    )}
                                    {estatisticas.metadados.regraFaturamento && <p className="text-xs text-gray-500 px-2">Critério de faturamento: {estatisticas.metadados.regraFaturamento}</p>}
                                </>
                            )}
                        </div>
                    )}

                    {abaAtiva === 'configuracoes' && <AdminConfiguracoes />}

                    {abaAtiva === 'relatorios' && <AdminRelatorios />}
                </div>
            </div>

            {logDetalhado && (
                <div className="agerp-modal-overlay fixed inset-0 z-[140] flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="detalhes-log-titulo" onMouseDown={event => { if (event.target === event.currentTarget) setLogDetalhado(null); }}>
                    <div className="agerp-modal-panel max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 sm:p-8">
                        <div className="flex items-start justify-between gap-4">
                            <div><h2 id="detalhes-log-titulo" className="text-2xl font-semibold">Detalhes do evento</h2><p className="text-sm text-gray-500 mt-1">Registro de auditoria #{logDetalhado.id}</p></div>
                            <button ref={fecharLogRef} onClick={() => setLogDetalhado(null)} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-2xl text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Fechar detalhes">×</button>
                        </div>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-sm">
                            <div><dt className="text-gray-500">Data/Hora</dt><dd className="font-medium mt-1">{new Date(logDetalhado.dataHora).toLocaleString('pt-BR')}</dd></div>
                            <div><dt className="text-gray-500">Ação</dt><dd className="font-medium mt-1">{logDetalhado.acao}</dd></div>
                            <div><dt className="text-gray-500">Usuário</dt><dd className="font-medium mt-1">{valorLog(logDetalhado, 'nomeUsuario', 'usuarioNome')}</dd></div>
                            <div><dt className="text-gray-500">E-mail</dt><dd className="font-medium mt-1 break-all">{valorLog(logDetalhado, 'emailUsuario', 'usuarioEmail')}</dd></div>
                            <div><dt className="text-gray-500">Cargo/Perfil</dt><dd className="font-medium mt-1">{valorLog(logDetalhado, 'perfilUsuario', 'usuarioPerfil')}</dd></div>
                            <div><dt className="text-gray-500">Entidade</dt><dd className="font-medium mt-1">{logDetalhado.entidade || '—'}</dd></div>
                            <div><dt className="text-gray-500">Recurso afetado</dt><dd className="font-medium mt-1">{logDetalhado.recursoId ?? '—'}</dd></div>
                            <div><dt className="text-gray-500">Resultado</dt><dd className="font-medium mt-1">{logDetalhado.resultado || '—'}</dd></div>
                            <div className="sm:col-span-2"><dt className="text-gray-500">IP</dt><dd className="font-mono mt-1">{logDetalhado.ip || '—'}</dd></div>
                            {logDetalhado.detalhes && <div className="sm:col-span-2"><dt className="text-gray-500">Informações adicionais</dt><dd className="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-gray-50 border border-gray-200 p-4">{logDetalhado.detalhes}</dd></div>}
                        </dl>
                        <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-sm break-all">
                            <p>Origem: {logDetalhado.origemConfianca ?? 'DESCONHECIDA'} — IP e User-Agent não identificam uma pessoa ou dispositivo físico.</p>
                            <p>Identidade histórica: {logDetalhado.identidadeHistoricaConfirmada ? 'Snapshot registrado' : 'Desconhecida ou incompleta (legado)'}</p>
                            <p>Sessão: {logDetalhado.sessionRef ?? 'Desconhecida'} | Dispositivo lógico: {logDetalhado.deviceRef ?? 'Desconhecido'}</p>
                            <p>Request: {logDetalhado.requestId ?? 'Desconhecido'} | Correlação: {logDetalhado.correlationId ?? 'Desconhecida'}</p>
                            <p>HTTP: {logDetalhado.httpMethod ?? '?'} {logDetalhado.httpRoute ?? '?'} — {logDetalhado.httpStatus ?? '?'}</p>
                            <p>IP peer: {logDetalhado.peerIp ?? 'Desconhecido'} | User-Agent: {logDetalhado.userAgent ?? 'Desconhecido'}</p>
                            <p>Diferenças (somente campos permitidos; dados omitidos/mascarados não são recuperáveis):</p>
                            <pre className="overflow-x-auto whitespace-pre-wrap break-words">{logDetalhado.changesJson ? JSON.stringify(logDetalhado.changesJson, null, 2) : 'Não registradas / histórico desconhecido'}</pre>
                            <div className="flex flex-wrap gap-2">
                                {logDetalhado.entidade && logDetalhado.recursoId && <button className="rounded border px-3 py-2" onClick={() => { setFiltrosAvancados(atual => ({ ...atual, entidade: logDetalhado.entidade, recursoId: String(logDetalhado.recursoId) })); setFiltrosAplicados(atual => ({ ...atual, entidade: logDetalhado.entidade, recursoId: String(logDetalhado.recursoId) })); setPaginaLogs(0); setLogDetalhado(null); }}>Histórico do recurso</button>}
                                {logDetalhado.sessionRef && <button className="rounded border px-3 py-2" onClick={() => { setFiltrosAvancados(atual => ({ ...atual, sessionRef: logDetalhado.sessionRef! })); setFiltrosAplicados(atual => ({ ...atual, sessionRef: logDetalhado.sessionRef! })); setPaginaLogs(0); setLogDetalhado(null); }}>Linha do tempo da sessão</button>}
                                {logDetalhado.requestId && <button className="rounded border px-3 py-2" onClick={() => { setFiltrosAvancados(atual => ({ ...atual, requestId: logDetalhado.requestId! })); setFiltrosAplicados(atual => ({ ...atual, requestId: logDetalhado.requestId! })); setPaginaLogs(0); setLogDetalhado(null); }}>Linha do tempo da requisição</button>}
                            </div>
                        </div>
                        <button onClick={() => setLogDetalhado(null)} className="w-full mt-7 py-3 bg-slate-900 text-white rounded-2xl">Fechar</button>
                    </div>
                </div>
            )}

            {usuarioEditando && formEdicao && (
                <div className="agerp-modal-overlay fixed inset-0 z-[130] flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="editar-usuario-titulo">
                    <form onSubmit={salvarEdicao} className="agerp-modal-panel w-full max-w-xl rounded-3xl bg-white p-5 sm:p-8">
                        <h2 id="editar-usuario-titulo" className="text-2xl font-semibold">Editar usuário</h2>
                        <p className="text-sm text-gray-500 mt-1">Dados cadastrais e perfil de acesso.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 rounded-2xl bg-gray-50 p-4 text-sm">
                            <div><span className="block text-gray-500">ID</span><strong>{usuarioEditando.id}</strong></div>
                            <div><span className="block text-gray-500">Status</span><strong>{statusDoUsuario(usuarioEditando)}</strong></div>
                            <div className="sm:col-span-2"><span className="block text-gray-500">Cadastro</span><strong>{usuarioEditando.dataCriacao ? new Date(usuarioEditando.dataCriacao).toLocaleString('pt-BR') : 'Não informado'}</strong></div>
                        </div>

                        <div className="space-y-5 mt-6">
                            <div>
                                <label htmlFor="editar-nome" className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                                <input ref={nomeEdicaoRef} id="editar-nome" required minLength={3} maxLength={150} value={formEdicao.nome} onChange={event => setFormEdicao({ ...formEdicao, nome: event.target.value })} className="w-full rounded-2xl border border-gray-300 py-3 px-4" />
                            </div>
                            <div>
                                <label htmlFor="editar-email" className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                                <input id="editar-email" type="email" required maxLength={150} value={formEdicao.email} onChange={event => setFormEdicao({ ...formEdicao, email: event.target.value })} className="w-full rounded-2xl border border-gray-300 py-3 px-4" />
                            </div>
                            <div>
                                <label htmlFor="editar-perfil" className="block text-sm font-medium text-gray-700 mb-1">Cargo/perfil de acesso</label>
                                <select id="editar-perfil" required value={formEdicao.idPerfil} onChange={event => setFormEdicao({ ...formEdicao, idPerfil: Number(event.target.value) })} className="w-full rounded-2xl border border-gray-300 py-3 px-4 bg-white">
                                    {perfis.map(perfil => <option key={perfil.id} value={perfil.id}>{perfil.nome}</option>)}
                                </select>
                            </div>
                        </div>

                        {edicaoAlterada && <p className="mt-5 text-sm text-amber-800 bg-amber-50 rounded-xl p-3">Existem alterações não salvas.</p>}
                        <p className="mt-4 text-xs text-gray-500">Status e senha são gerenciados pelas ações administrativas separadas.</p>
                        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-7">
                            <button type="button" disabled={salvandoEdicao} onClick={() => fecharEdicao()} className="flex-1 py-3.5 border border-gray-300 rounded-2xl disabled:opacity-50">Cancelar</button>
                            <button type="submit" disabled={salvandoEdicao || !edicaoAlterada} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl disabled:opacity-50">{salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}</button>
                        </div>
                    </form>
                </div>
            )}

            {acaoConfirmacao && (
                <div className="agerp-modal-overlay fixed inset-0 z-[120] flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="confirmar-status-titulo">
                    <div className="agerp-modal-panel w-full max-w-md rounded-3xl bg-white p-5 sm:p-8">
                        <h3 id="confirmar-status-titulo" className="text-xl font-semibold">Confirmar ação</h3>
                        <p className="text-gray-600 mt-3">
                            Deseja realmente {acaoConfirmacao.acao} o usuário <strong>{acaoConfirmacao.usuario.nome}</strong>?
                            {acaoConfirmacao.acao === 'bloquear' && ' O acesso será revogado imediatamente.'}
                        </p>
                        <div className="mt-8 flex flex-col gap-3 min-[360px]:flex-row">
                            <button disabled={processandoAcao} onClick={() => setAcaoConfirmacao(null)} className="flex-1 py-3.5 border border-gray-300 rounded-2xl disabled:opacity-50">Cancelar</button>
                            <button disabled={processandoAcao} onClick={executarAcaoStatus} className={`flex-1 py-3.5 text-white rounded-2xl disabled:opacity-50 ${acaoConfirmacao.acao === 'aprovar' ? 'bg-green-600' : 'bg-red-600'}`}>
                                {processandoAcao ? 'Processando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {usuarioRedefinicao && (
                <div className="agerp-modal-overlay fixed inset-0 z-[120] flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="redefinir-senha-titulo">
                    <div className="agerp-modal-panel w-full max-w-lg rounded-3xl bg-white p-5 sm:p-8">
                        <h3 id="redefinir-senha-titulo" className="text-xl font-semibold">Redefinir senha</h3>
                        {!credencialTemporaria ? (
                            <>
                                <p className="text-gray-600 mt-3">Uma credencial temporária de uso único será criada para <strong>{usuarioRedefinicao.nome}</strong>. As sessões anteriores serão invalidadas e o usuário deverá definir uma senha definitiva no próximo acesso.</p>
                                <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-4">O status de aprovação ou bloqueio da conta não será alterado.</p>
                                <div className="mt-8 flex flex-col gap-3 min-[360px]:flex-row">
                                    <button disabled={processandoRedefinicao} onClick={fecharRedefinicao} className="flex-1 py-3.5 border border-gray-300 rounded-2xl disabled:opacity-50">Cancelar</button>
                                    <button disabled={processandoRedefinicao} onClick={executarRedefinicao} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl disabled:opacity-50">{processandoRedefinicao ? 'Gerando...' : 'Gerar credencial'}</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-gray-600 mt-3">Copie e entregue esta credencial por um canal seguro. Ela não será exibida novamente.</p>
                                <div className="mt-5 rounded-2xl bg-slate-100 border border-slate-200 p-5">
                                    <div className="text-xs uppercase tracking-wide text-gray-500">Credencial temporária</div>
                                    <div className="font-mono text-xl font-semibold break-all mt-1" aria-label="Credencial temporária">{credencialTemporaria.senha}</div>
                                    <div className="text-sm text-gray-600 mt-4">Expira em {new Date(credencialTemporaria.expiraEm).toLocaleString('pt-BR')}</div>
                                </div>
                                <button onClick={fecharRedefinicao} className="w-full mt-7 py-3.5 bg-slate-900 text-white rounded-2xl">Concluído</button>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[110] space-y-2 sm:left-auto sm:right-6 sm:max-w-md">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`px-6 py-4 rounded-2xl shadow-xl text-white flex items-center gap-3 ${
                            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                        }`}
                    >
                        {toast.type === 'success' ? '✅' : '❌'}
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Admin;
