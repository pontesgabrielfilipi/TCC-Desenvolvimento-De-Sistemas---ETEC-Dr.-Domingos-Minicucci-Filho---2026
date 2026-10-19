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
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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

    // Toasts
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
    }, [buscaLogsAplicada, camposFiltroLog, dataFimLog, dataInicioLog, paginaLogs, showToast, sortLogs]);

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
            const response = perfis.length ? { data: perfis } : await usuarioService.listarPerfis();
            if (!perfis.length) setPerfis(response.data);
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
    };

    const limparFiltrosLogs = () => {
        setBuscaLogs('');
        setBuscaLogsAplicada('');
        setDataInicioLog('');
        setDataFimLog('');
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

    const evolucaoClientesAgrupada = (evolucao: AdminEstatisticas['clientes']['evolucao']) => {
        const porPeriodo = new Map<string, Record<string, string | number>>();
        evolucao.forEach(item => {
            const linha = porPeriodo.get(item.periodo) ?? { periodo: item.periodo };
            linha[`cliente_${item.id}`] = item.pedidos;
            porPeriodo.set(item.periodo, linha);
        });
        return Array.from(porPeriodo.values());
    };

    const abas = [
        { id: 'usuarios', label: '👥 Gerenciar Usuários', icon: '👥' },
        { id: 'logs',     label: '📜 Logs do Sistema',    icon: '📜' },
        { id: 'estatisticas', label: '📊 Estatísticas', icon: '📊' },
        { id: 'configuracoes', label: '⚙️ Configurações', icon: '⚙️' },
        { id: 'relatorios', label: '📈 Relatórios', icon: '📈' },
    ];

    return (
        <div className="flex h-full min-w-0 bg-gray-50">
            {/* Conteúdo Principal */}
            <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b px-4 sm:px-8 py-4 sm:py-5 flex items-center gap-3">
                    <span className="text-3xl">🔧</span>
                    <h1 className="text-2xl font-semibold text-gray-800">Painel Administrativo</h1>
                </header>

                <div className="min-w-0 p-3 sm:p-6 xl:p-8 flex-1 overflow-y-auto overflow-x-hidden">
                    {/* Tabs */}
                    <div className="flex border-b mb-6 overflow-x-auto max-w-full" role="tablist" aria-label="Seções administrativas">
                        {abas.map(aba => (
                            <button
                                key={aba.id}
                                onClick={() => setAbaAtiva(aba.id)}
                                className={`shrink-0 whitespace-nowrap px-4 sm:px-8 py-3 sm:py-4 font-medium transition border-b-2 flex items-center gap-2 ${
                                    abaAtiva === aba.id
                                        ? 'border-indigo-600 text-indigo-600'
                                        : 'border-transparent hover:text-gray-700'
                                }`}
                            >
                                {aba.icon} {aba.label}
                            </button>
                        ))}
                    </div>

                    {/* Aba Usuários */}
                    {abaAtiva === 'usuarios' && (
                        <div>
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                <h2 className="text-xl font-semibold">Gerenciamento de Usuários</h2>
                                <input value={buscaUsuarios} onChange={event => setBuscaUsuarios(event.target.value)} placeholder="Pesquisar nome, e-mail, perfil ou ID" aria-label="Pesquisar usuários" className="min-w-0 sm:w-72 rounded-xl border border-gray-300 px-4 py-2" />
                                <button onClick={() => void carregarUsuarios(true)} disabled={loading} className="rounded-xl border border-gray-300 px-4 py-2 font-medium disabled:opacity-50">{loading ? 'Atualizando...' : '↻ Atualizar'}</button>
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                    Status
                                    <select value={filtroStatus} onChange={event => setFiltroStatus(event.target.value)} className="rounded-xl border border-gray-300 px-4 py-2 bg-white">
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
                            ) : (
                                <div className="bg-white rounded-3xl shadow-sm overflow-x-auto" role="region" aria-label="Tabela de usuários" tabIndex={0}>
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
                            )}
                        </div>
                    )}

                    {/* Aba Logs */}
                    {abaAtiva === 'logs' && (
                        <div>
                            <div className="mb-6">
                                <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Auditoria do Sistema</h2><button onClick={() => void carregarLogs(true)} disabled={logsCarregando} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50">{logsCarregando ? 'Atualizando...' : '↻ Atualizar'}</button></div>
                                <p className="text-sm text-gray-500 mt-1">{totalLogs} evento{totalLogs === 1 ? '' : 's'} encontrado{totalLogs === 1 ? '' : 's'}</p>
                            </div>
                            <form onSubmit={pesquisarLogs} className="bg-white rounded-3xl shadow-sm p-5 mb-5" aria-label="Filtros de auditoria">
                                <div className="flex flex-col lg:flex-row gap-3">
                                    <label className="flex-1"><span className="sr-only">Termo de pesquisa</span><input value={buscaLogs} onChange={event => setBuscaLogs(event.target.value)} placeholder="Pesquisar nos campos selecionados" className="w-full rounded-xl border border-gray-300 px-4 py-3" /></label>
                                    <label className="text-sm text-gray-700"><span className="block mb-1">Data inicial</span><input type="date" value={dataInicioLog} max={dataFimLog || undefined} onChange={event => { setDataInicioLog(event.target.value); setPaginaLogs(0); }} className="rounded-xl border border-gray-300 px-3 py-2" /></label>
                                    <label className="text-sm text-gray-700"><span className="block mb-1">Data final</span><input type="date" value={dataFimLog} min={dataInicioLog || undefined} onChange={event => { setDataFimLog(event.target.value); setPaginaLogs(0); }} className="rounded-xl border border-gray-300 px-3 py-2" /></label>
                                </div>
                                <fieldset className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                                    <legend className="sr-only">Campos pesquisados</legend>
                                    {([['email', 'E-mail'], ['perfil', 'Cargo/Perfil'], ['acao', 'Ação'], ['entidade', 'Entidade'], ['ip', 'IP']] as const).map(([campo, rotulo]) => (
                                        <label key={campo} className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={camposFiltroLog[campo]} onChange={() => { setCamposFiltroLog(atuais => ({ ...atuais, [campo]: !atuais[campo] })); setPaginaLogs(0); }} className="h-4 w-4 rounded border-gray-300" />{rotulo}</label>
                                    ))}
                                    <div className="sm:ml-auto flex gap-2">
                                        <button type="button" onClick={limparFiltrosLogs} className="rounded-xl border border-gray-300 px-4 py-2 text-sm">Limpar</button>
                                        <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-2 text-sm text-white">Pesquisar</button>
                                    </div>
                                </fieldset>
                            </form>
                            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
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
                                            <td className="px-6 py-4 whitespace-nowrap">{new Date(log.dataHora).toLocaleString('pt-BR')}</td>
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
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div><h2 className="text-xl font-semibold">Estatísticas administrativas</h2><p className="text-sm text-gray-500 mt-1">Indicadores calculados a partir dos dados reais do período.</p></div>
                                <div className="flex gap-2"><button onClick={limparFiltrosEstatisticas} className="rounded-xl border border-gray-300 px-4 py-2 text-sm">Limpar filtros</button><button onClick={() => void carregarEstatisticas(true)} disabled={estatisticasCarregando} className="rounded-xl bg-indigo-600 text-white px-5 py-2 text-sm disabled:opacity-50">Atualizar</button></div>
                            </div>

                            <div className="bg-white rounded-3xl shadow-sm p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                                <label className="text-sm text-gray-700"><span className="block mb-1">Data inicial</span><input type="date" value={inicioEstatisticas} max={fimEstatisticas || undefined} onChange={event => { setInicioEstatisticas(event.target.value); reiniciarPaginasEstatisticas(); }} className="w-full rounded-xl border border-gray-300 px-3 py-2" /></label>
                                <label className="text-sm text-gray-700"><span className="block mb-1">Data final</span><input type="date" value={fimEstatisticas} min={inicioEstatisticas || undefined} onChange={event => { setFimEstatisticas(event.target.value); reiniciarPaginasEstatisticas(); }} className="w-full rounded-xl border border-gray-300 px-3 py-2" /></label>
                                <details className="relative"><summary className="cursor-pointer rounded-xl border border-gray-300 px-4 py-2.5 text-sm list-none">Usuários ({usuariosSelecionados.length || 'todos'})</summary><div className="absolute z-20 mt-2 max-h-64 overflow-auto w-72 bg-white border rounded-xl shadow-xl p-3 space-y-2">{usuarios.map(item => <label key={item.id} className="flex gap-2 text-sm"><input type="checkbox" checked={usuariosSelecionados.includes(item.id)} onChange={() => alternarFiltroEstatisticas(item.id, usuariosSelecionados, setUsuariosSelecionados)} /><span>{item.nome} <span className="text-gray-500">({item.email})</span></span></label>)}</div></details>
                                <details className="relative"><summary className="cursor-pointer rounded-xl border border-gray-300 px-4 py-2.5 text-sm list-none">Clientes ({clientesSelecionados.length || 'todos'})</summary><div className="absolute z-20 mt-2 max-h-64 overflow-auto w-72 bg-white border rounded-xl shadow-xl p-3 space-y-2">{clientesOpcoes.length ? clientesOpcoes.map(item => <label key={item.id} className="flex gap-2 text-sm"><input type="checkbox" checked={clientesSelecionados.includes(item.id)} onChange={() => alternarFiltroEstatisticas(item.id, clientesSelecionados, setClientesSelecionados)} />{item.nomeRazao}</label>) : <p className="text-sm text-gray-500">Nenhum cliente disponível.</p>}</div></details>
                                <details className="relative"><summary className="cursor-pointer rounded-xl border border-gray-300 px-4 py-2.5 text-sm list-none">Status ({statusSelecionados.length || 'todos'})</summary><div className="absolute z-20 mt-2 max-h-64 overflow-auto w-64 bg-white border rounded-xl shadow-xl p-3 space-y-2">{estatisticas?.filtrosDisponiveis.statusPedidos?.map(status => <label key={status} className="flex gap-2 text-sm"><input type="checkbox" checked={statusSelecionados.includes(status)} onChange={() => alternarFiltroEstatisticas(status, statusSelecionados, setStatusSelecionados)} />{status}</label>) ?? <p className="text-sm text-gray-500">Carregando opções...</p>}</div></details>
                                <label className="md:col-span-2 xl:col-span-5 text-sm text-gray-500"><span className="block mb-1">Categoria/Tipo de produto</span><input disabled value="Filtro indisponível" className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-2 text-gray-500" /><span className="block mt-1 text-xs">{estatisticas?.metadados.categoriaProduto || 'O schema atual não possui categoria de produto.'}</span></label>
                            </div>

                            {estatisticas && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 space-y-1"><p>Totais cadastrais de usuários, clientes, produtos e estoque são globais e não variam com os filtros transacionais.</p><p>Movimentações por usuário respeitam usuário e período; cliente e status do pedido não se aplicam a essa métrica.</p></div>}

                            {estatisticasCarregando ? <div className="bg-white rounded-3xl py-20 text-center text-gray-500">Carregando estatísticas...</div> : estatisticasErro ? <div className="bg-white rounded-3xl py-16 text-center"><p className="text-red-700">{estatisticasErro}</p><button onClick={() => void carregarEstatisticas()} className="mt-3 text-indigo-700 font-medium">Tentar novamente</button></div> : !estatisticas ? <div className="bg-white rounded-3xl py-20 text-center text-gray-500">Nenhum dado disponível.</div> : (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                                        {[['Usuários', estatisticas.usuarios.total], ['Clientes', estatisticas.clientes.total], ['Pedidos', estatisticas.pedidos.total], ['Faturamento', moeda(estatisticas.pedidos.faturamento)], ['Ticket médio', moeda(estatisticas.pedidos.ticketMedio)], ['Estoque baixo', estatisticas.produtos.estoqueBaixo]].map(([rotulo, valor]) => <div key={rotulo} className="bg-white rounded-2xl shadow-sm p-5"><p className="text-xs uppercase tracking-wide text-gray-500">{rotulo}</p><p className="text-2xl font-semibold mt-2 break-words">{valor}</p></div>)}
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                                        {[['Usuários ativos', estatisticas.usuarios.ativos], ['Usuários pendentes', estatisticas.usuarios.pendentes], ['Usuários bloqueados', estatisticas.usuarios.bloqueados], ['Clientes com pedidos', estatisticas.clientes.comPedidos], ['Produtos', estatisticas.produtos.total], ['Quantidade vendida', estatisticas.produtos.quantidadeVendida], ['Valor vendido', moeda(estatisticas.produtos.valorVendido)], ['Estoque disponível', estatisticas.produtos.estoqueDisponivel], ['Pedidos pendentes', estatisticas.pedidos.pendentes], ['Pedidos em andamento', estatisticas.pedidos.emAndamento], ['Pedidos concluídos', estatisticas.pedidos.concluidos], ['Pedidos cancelados', estatisticas.pedidos.cancelados]].map(([rotulo, valor]) => <div key={rotulo} className="bg-white rounded-2xl shadow-sm p-5"><p className="text-xs uppercase tracking-wide text-gray-500">{rotulo}</p><p className="text-xl font-semibold mt-2 break-words">{valor}</p></div>)}
                                    </div>
                                    {estatisticas.pedidos.total === 0 && estatisticas.clientes.evolucao.length === 0 && estatisticas.usuarios.movimentacoes.totalElementos === 0 ? <div className="bg-white rounded-3xl py-14 text-center text-gray-500">Não há dados transacionais para os filtros selecionados.</div> : (
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                            <div className="bg-white rounded-3xl shadow-sm p-5"><h3 className="font-semibold mb-4">Evolução de pedidos</h3><div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={estatisticas.pedidos.evolucaoMensal}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="periodo" /><YAxis /><Tooltip formatter={(value) => moeda(Number(value))} /><Legend /><Line type="monotone" dataKey="valor" name="Faturamento" stroke="#4f46e5" /><Line type="monotone" dataKey="quantidade" name="Pedidos" stroke="#059669" /></LineChart></ResponsiveContainer></div></div>
                                            <div className="bg-white rounded-3xl shadow-sm p-5"><h3 className="font-semibold mb-4">Pedidos por status</h3><div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={estatisticas.pedidos.distribuicaoStatus} dataKey="quantidade" nameKey="nome" fill="#4f46e5" label /><Tooltip /></PieChart></ResponsiveContainer></div></div>
                                            <div className="bg-white rounded-3xl shadow-sm p-5"><h3 className="font-semibold mb-4">Perfis de usuários</h3><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={estatisticas.usuarios.distribuicaoPerfis}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="nome" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="quantidade" name="Usuários" fill="#7c3aed" /></BarChart></ResponsiveContainer></div></div>
                                            <div className="bg-white rounded-3xl shadow-sm p-5 overflow-hidden"><h3 className="font-semibold mb-4">Produtos mais vendidos</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-3">Produto</th><th className="text-right">Quantidade</th><th className="text-right">Valor</th></tr></thead><tbody>{estatisticas.produtos.topVendidos.conteudo.map(item => <tr key={item.id} className="border-b last:border-0"><td className="py-3">{item.nome}</td><td className="text-right">{item.quantidade}</td><td className="text-right">{moeda(item.valor)}</td></tr>)}{!estatisticas.produtos.topVendidos.conteudo.length && <tr><td colSpan={3} className="py-10 text-center text-gray-500">Sem vendas no período.</td></tr>}</tbody></table></div>{estatisticas.produtos.topVendidos.totalPaginas > 1 && <div className="mt-4 flex items-center justify-between text-sm"><span>Página {estatisticas.produtos.topVendidos.pagina + 1} de {estatisticas.produtos.topVendidos.totalPaginas}</span><div className="flex gap-2"><button disabled={paginaProdutos === 0} onClick={() => setPaginaProdutos(atual => Math.max(0, atual - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Anterior</button><button disabled={paginaProdutos + 1 >= estatisticas.produtos.topVendidos.totalPaginas} onClick={() => setPaginaProdutos(atual => atual + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Próxima</button></div></div>}</div>
                                            <div className="bg-white rounded-3xl shadow-sm p-5 xl:col-span-2 overflow-hidden"><h3 className="font-semibold mb-4">Desempenho por usuário</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-3">Usuário</th><th className="text-right">Pedidos</th><th className="text-right">Faturamento</th></tr></thead><tbody>{estatisticas.usuarios.desempenho.conteudo.map(item => <tr key={item.id} className="border-b last:border-0"><td className="py-3">{item.nome}</td><td className="text-right">{item.pedidos}</td><td className="text-right">{moeda(item.faturamento)}</td></tr>)}{!estatisticas.usuarios.desempenho.conteudo.length && <tr><td colSpan={3} className="py-10 text-center text-gray-500">Sem desempenho no período.</td></tr>}</tbody></table></div>{estatisticas.usuarios.desempenho.totalPaginas > 1 && <div className="mt-4 flex items-center justify-between text-sm"><span>Página {estatisticas.usuarios.desempenho.pagina + 1} de {estatisticas.usuarios.desempenho.totalPaginas}</span><div className="flex gap-2"><button disabled={paginaUsuariosEstatisticas === 0} onClick={() => setPaginaUsuariosEstatisticas(atual => Math.max(0, atual - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Anterior</button><button disabled={paginaUsuariosEstatisticas + 1 >= estatisticas.usuarios.desempenho.totalPaginas} onClick={() => setPaginaUsuariosEstatisticas(atual => atual + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Próxima</button></div></div>}</div>
                                            <div className="bg-white rounded-3xl shadow-sm p-5"><h3 className="font-semibold mb-4">Evolução de pedidos por cliente</h3>{estatisticas.clientes.evolucao.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={evolucaoClientesAgrupada(estatisticas.clientes.evolucao)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="periodo" /><YAxis allowDecimals={false} /><Tooltip /><Legend />{Array.from(new Map(estatisticas.clientes.evolucao.map(item => [item.id, item.nome])).entries()).map(([id, nome]) => <Line key={id} type="monotone" dataKey={`cliente_${id}`} name={nome} />)}</LineChart></ResponsiveContainer></div> : <div className="py-12 text-center text-sm text-gray-500">Sem evolução de clientes no período.</div>}</div>
                                            <div className="bg-white rounded-3xl shadow-sm p-5 xl:col-span-2 overflow-hidden"><h3 className="font-semibold mb-4">Movimentações de estoque por usuário</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-3">Usuário</th><th className="text-right">Movimentações</th><th className="text-right">Entradas</th><th className="text-right">Saídas</th></tr></thead><tbody>{estatisticas.usuarios.movimentacoes.conteudo.map(item => <tr key={item.id} className="border-b last:border-0"><td className="py-3">{item.nome}</td><td className="text-right">{item.movimentacoes}</td><td className="text-right">{item.quantidadeEntrada}</td><td className="text-right">{item.quantidadeSaida}</td></tr>)}{!estatisticas.usuarios.movimentacoes.conteudo.length && <tr><td colSpan={4} className="py-10 text-center text-gray-500">Sem movimentações no período.</td></tr>}</tbody></table></div>{estatisticas.usuarios.movimentacoes.totalPaginas > 1 && <div className="mt-4 flex items-center justify-between text-sm"><span>Página {estatisticas.usuarios.movimentacoes.pagina + 1} de {estatisticas.usuarios.movimentacoes.totalPaginas}</span><div className="flex gap-2"><button disabled={paginaMovimentacoes === 0} onClick={() => setPaginaMovimentacoes(atual => Math.max(0, atual - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Anterior</button><button disabled={paginaMovimentacoes + 1 >= estatisticas.usuarios.movimentacoes.totalPaginas} onClick={() => setPaginaMovimentacoes(atual => atual + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Próxima</button></div></div>}</div>
                                            <div className="bg-white rounded-3xl shadow-sm p-5 overflow-hidden"><h3 className="font-semibold mb-4">Clientes mais frequentes</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-3">Cliente</th><th className="text-right">Pedidos</th><th className="text-right">Faturamento</th></tr></thead><tbody>{estatisticas.clientes.topFrequentes.conteudo.map(item => <tr key={item.id} className="border-b last:border-0"><td className="py-3">{item.nome}</td><td className="text-right">{item.pedidos}</td><td className="text-right">{moeda(item.faturamento)}</td></tr>)}{!estatisticas.clientes.topFrequentes.conteudo.length && <tr><td colSpan={3} className="py-10 text-center text-gray-500">Sem clientes no período.</td></tr>}</tbody></table></div>{estatisticas.clientes.topFrequentes.totalPaginas > 1 && <div className="mt-4 flex items-center justify-between text-sm"><span>Página {estatisticas.clientes.topFrequentes.pagina + 1} de {estatisticas.clientes.topFrequentes.totalPaginas}</span><div className="flex gap-2"><button disabled={paginaClientes === 0} onClick={() => setPaginaClientes(atual => Math.max(0, atual - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Anterior</button><button disabled={paginaClientes + 1 >= estatisticas.clientes.topFrequentes.totalPaginas} onClick={() => setPaginaClientes(atual => atual + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Próxima</button></div></div>}</div>
                                        </div>
                                    )}
                                    {estatisticas.metadados.regraFaturamento && <p className="text-xs text-gray-500 px-2">Critério de faturamento: {estatisticas.metadados.regraFaturamento}</p>}
                                </>
                            )}
                        </div>
                    )}

                    {abaAtiva === 'configuracoes' && <AdminConfiguracoes />}

                    {/* Relatorios ainda nao implementados */}
                    {abaAtiva === 'relatorios' && (
                        <div className="text-center py-20 text-gray-500 text-2xl">
                            Funcionalidade em desenvolvimento
                        </div>
                    )}
                </div>
            </div>

            {logDetalhado && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[140] p-4" role="dialog" aria-modal="true" aria-labelledby="detalhes-log-titulo" onMouseDown={event => { if (event.target === event.currentTarget) setLogDetalhado(null); }}>
                    <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8">
                        <div className="flex items-start justify-between gap-4">
                            <div><h2 id="detalhes-log-titulo" className="text-2xl font-semibold">Detalhes do evento</h2><p className="text-sm text-gray-500 mt-1">Registro de auditoria #{logDetalhado.id}</p></div>
                            <button onClick={() => setLogDetalhado(null)} className="text-gray-500 hover:text-gray-900 text-2xl" aria-label="Fechar detalhes">×</button>
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
                        <button onClick={() => setLogDetalhado(null)} className="w-full mt-7 py-3 bg-slate-900 text-white rounded-2xl">Fechar</button>
                    </div>
                </div>
            )}

            {usuarioEditando && formEdicao && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[130] p-4" role="dialog" aria-modal="true" aria-labelledby="editar-usuario-titulo">
                    <form onSubmit={salvarEdicao} className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8">
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
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[120]" role="dialog" aria-modal="true" aria-labelledby="confirmar-status-titulo">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4">
                        <h3 id="confirmar-status-titulo" className="text-xl font-semibold">Confirmar ação</h3>
                        <p className="text-gray-600 mt-3">
                            Deseja realmente {acaoConfirmacao.acao} o usuário <strong>{acaoConfirmacao.usuario.nome}</strong>?
                            {acaoConfirmacao.acao === 'bloquear' && ' O acesso será revogado imediatamente.'}
                        </p>
                        <div className="flex gap-3 mt-8">
                            <button disabled={processandoAcao} onClick={() => setAcaoConfirmacao(null)} className="flex-1 py-3.5 border border-gray-300 rounded-2xl disabled:opacity-50">Cancelar</button>
                            <button disabled={processandoAcao} onClick={executarAcaoStatus} className={`flex-1 py-3.5 text-white rounded-2xl disabled:opacity-50 ${acaoConfirmacao.acao === 'aprovar' ? 'bg-green-600' : 'bg-red-600'}`}>
                                {processandoAcao ? 'Processando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {usuarioRedefinicao && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[120]" role="dialog" aria-modal="true" aria-labelledby="redefinir-senha-titulo">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full mx-4">
                        <h3 id="redefinir-senha-titulo" className="text-xl font-semibold">Redefinir senha</h3>
                        {!credencialTemporaria ? (
                            <>
                                <p className="text-gray-600 mt-3">Uma credencial temporária de uso único será criada para <strong>{usuarioRedefinicao.nome}</strong>. As sessões anteriores serão invalidadas e o usuário deverá definir uma senha definitiva no próximo acesso.</p>
                                <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-4">O status de aprovação ou bloqueio da conta não será alterado.</p>
                                <div className="flex gap-3 mt-8">
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

            {/* Toasts */}
            <div className="fixed bottom-6 right-6 space-y-2 z-[110]">
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
