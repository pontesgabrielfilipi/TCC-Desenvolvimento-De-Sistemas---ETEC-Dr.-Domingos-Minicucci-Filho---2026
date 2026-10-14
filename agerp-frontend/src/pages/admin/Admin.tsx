import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usuarioService } from '../../services/usuarioService';
import { logService } from '../../services/logService';

interface Usuario {
    id: number;
    nome: string;
    email: string;
    perfilNome: string;
    ativo: boolean;
}

interface Log {
    id: number;
    acao: string;
    entidade: string;
    dataHora: string;
    ip: string;
}

interface Toast {
    id: number;
    type: 'success' | 'error';
    message: string;
}

const Admin = () => {
    const { user, logout } = useAuth();
    const [abaAtiva, setAbaAtiva] = useState('usuarios');

    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal de Edição
    const [modalOpen, setModalOpen] = useState(false);
    const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);

    // Popover Exclusão
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

    // Toasts
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((type: 'success' | 'error', message: string) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const carregarUsuarios = useCallback(async () => {
        try {
            const res = await usuarioService.listarTodos();
            setUsuarios(res.data);
        } catch (error) {
            console.error(error);
            showToast('error', 'Erro ao carregar usuários');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const carregarLogs = useCallback(async () => {
        try {
            const res = await logService.listarTodos();
            setLogs(res.data);
        } catch (error) {
            console.error(error);
            showToast('error', 'Erro ao carregar logs');
        }
    }, [showToast]);

    useEffect(() => {
        if (abaAtiva === 'usuarios') carregarUsuarios();
        if (abaAtiva === 'logs') carregarLogs();
    }, [abaAtiva, carregarLogs, carregarUsuarios]);

    const abrirModalEdicao = (usuario: Usuario) => {
        setUsuarioEditando({ ...usuario });
        setModalOpen(true);
    };

    const fecharModal = () => {
        setModalOpen(false);
        setUsuarioEditando(null);
    };

    const salvarEdicao = async () => {
        if (!usuarioEditando) return;

        try {
            await usuarioService.atualizar(usuarioEditando.id, {
                nome: usuarioEditando.nome,
                email: usuarioEditando.email,
                idPerfil: usuarioEditando.perfilNome === 'ADMIN' ? 1 :
                    usuarioEditando.perfilNome === 'GERENTE' ? 2 : 3
            });
            showToast('success', 'Usuário atualizado com sucesso!');
            fecharModal();
            carregarUsuarios();
        } catch {
            showToast('error', 'Erro ao atualizar usuário');
        }
    };

    const confirmarExclusao = (id: number) => setDeleteConfirmId(id);

    const executarExclusao = async () => {
        if (!deleteConfirmId) return;
        try {
            await usuarioService.deletar(deleteConfirmId);
            showToast('success', 'Usuário excluído com sucesso!');
            carregarUsuarios();
        } catch {
            showToast('error', 'Erro ao excluir usuário');
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const abas = [
        { id: 'usuarios', label: '👥 Gerenciar Usuários', icon: '👥' },
        { id: 'logs',     label: '📜 Logs do Sistema',    icon: '📜' },
        { id: 'estatisticas', label: '📊 Estatísticas', icon: '📊' },
        { id: 'configuracoes', label: '⚙️ Configurações', icon: '⚙️' },
        { id: 'relatorios', label: '📈 Relatórios', icon: '📈' },
    ];

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar - mesmo padrão do Dashboard e Clientes */}
            <div className="w-64 bg-slate-900 text-white flex flex-col">
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
                        to="/admin"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 text-white font-medium no-underline hover:no-underline"
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
                            <p className="text-xs text-emerald-400">Administrador</p>
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

            {/* Conteúdo Principal */}
            <div className="flex-1 flex flex-col">
                <header className="bg-white border-b px-8 py-5 flex items-center gap-3">
                    <span className="text-3xl">🔧</span>
                    <h1 className="text-2xl font-semibold text-gray-800">Painel Administrativo</h1>
                </header>

                <div className="p-8 flex-1 overflow-auto">
                    {/* Tabs */}
                    <div className="flex border-b mb-8">
                        {abas.map(aba => (
                            <button
                                key={aba.id}
                                onClick={() => setAbaAtiva(aba.id)}
                                className={`px-8 py-4 font-medium transition border-b-2 flex items-center gap-2 ${
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
                            <h2 className="text-xl font-semibold mb-6">Gerenciamento de Usuários</h2>
                            {loading ? (
                                <div className="text-center py-16 text-gray-500 font-medium">Carregando painel de usuários...</div>
                            ) : (
                                <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left">Nome</th>
                                        <th className="px-6 py-4 text-left">E-mail</th>
                                        <th className="px-6 py-4 text-left">Perfil</th>
                                        <th className="px-6 py-4 text-left">Status</th>
                                        <th className="px-6 py-4 text-center">Ações</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                    {usuarios.map((u) => (
                                        <tr key={u.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">{u.nome}</td>
                                            <td className="px-6 py-4">{u.email}</td>
                                            <td className="px-6 py-4">{u.perfilNome || '—'}</td>
                                            <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 text-xs rounded-full ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {u.ativo ? 'Ativo' : 'Inativo'}
                                                    </span>
                                            </td>
                                            <td className="px-6 py-4 text-center space-x-4">
                                                <button onClick={() => abrirModalEdicao(u)} className="text-indigo-600 hover:text-indigo-700">Editar</button>
                                                <button onClick={() => confirmarExclusao(u.id)} className="text-red-600 hover:text-red-700">Excluir</button>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                            )}
                        </div>
                    )}

                    {/* Aba Logs */}
                    {abaAtiva === 'logs' && (
                        <div>
                            <h2 className="text-xl font-semibold mb-6">Logs do Sistema</h2>
                            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left">Data/Hora</th>
                                        <th className="px-6 py-4 text-left">Ação</th>
                                        <th className="px-6 py-4 text-left">Entidade</th>
                                        <th className="px-6 py-4 text-left">IP</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                    {logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">{new Date(log.dataHora).toLocaleString('pt-BR')}</td>
                                            <td className="px-6 py-4">{log.acao}</td>
                                            <td className="px-6 py-4">{log.entidade}</td>
                                            <td className="px-6 py-4 font-mono text-sm">{log.ip}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Outras abas */}
                    {abaAtiva !== 'usuarios' && abaAtiva !== 'logs' && (
                        <div className="text-center py-20 text-gray-500 text-2xl">
                            Funcionalidade em desenvolvimento
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Edição */}
            {modalOpen && usuarioEditando && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl w-full max-w-lg mx-4 p-8">
                        <h2 className="text-2xl font-semibold mb-6">Editar Usuário</h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                                <input
                                    type="text"
                                    value={usuarioEditando.nome}
                                    onChange={(e) => setUsuarioEditando({ ...usuarioEditando, nome: e.target.value })}
                                    className="w-full rounded-2xl border border-gray-300 py-3 px-5"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                                <input
                                    type="email"
                                    value={usuarioEditando.email}
                                    onChange={(e) => setUsuarioEditando({ ...usuarioEditando, email: e.target.value })}
                                    className="w-full rounded-2xl border border-gray-300 py-3 px-5"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
                                <select
                                    value={usuarioEditando.perfilNome}
                                    onChange={(e) => setUsuarioEditando({ ...usuarioEditando, perfilNome: e.target.value })}
                                    className="w-full rounded-2xl border border-gray-300 py-3 px-5"
                                >
                                    <option value="ADMIN">ADMIN</option>
                                    <option value="GERENTE">GERENTE</option>
                                    <option value="OPERADOR">OPERADOR</option>
                                    <option value="FINANCEIRO">FINANCEIRO</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={usuarioEditando.ativo}
                                    onChange={(e) => setUsuarioEditando({ ...usuarioEditando, ativo: e.target.checked })}
                                />
                                <label className="text-sm font-medium text-gray-700">Usuário Ativo</label>
                            </div>

                            <div className="flex gap-4 pt-6">
                                <button onClick={fecharModal} className="flex-1 py-3.5 border border-gray-300 rounded-2xl font-medium">Cancelar</button>
                                <button onClick={salvarEdicao} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl font-medium hover:bg-indigo-700">Salvar Alterações</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Popover Exclusão */}
            {deleteConfirmId && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
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
