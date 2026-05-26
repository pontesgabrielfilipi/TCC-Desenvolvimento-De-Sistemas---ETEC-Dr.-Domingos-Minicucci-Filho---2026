import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { clienteService } from '../../services/clienteService';

interface Cliente {
    id: number;
    tipo: 'FISICA' | 'JURIDICA';
    nomeRazao: string;
    cpfCnpj: string;
    email: string;
    telefone: string;
}

interface Toast {
    id: number;
    type: 'success' | 'error';
    message: string;
}

const Clientes = () => {
    const { user, logout } = useAuth();

    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [busca, setBusca] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [editandoId, setEditandoId] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        tipo: 'FISICA' as 'FISICA' | 'JURIDICA',
        nomeRazao: '',
        cpfCnpj: '',
        email: '',
        telefone: ''
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

    const carregarClientes = async () => {
        try {
            setLoading(true);
            const response = await clienteService.listar();
            setClientes(response.data);
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            showToast('error', 'Erro ao carregar lista de clientes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarClientes();
    }, []);

    const clientesFiltrados = clientes.filter((c) =>
        c.nomeRazao.toLowerCase().includes(busca.toLowerCase()) ||
        c.cpfCnpj.includes(busca)
    );

    // Máscaras
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
            carregarClientes();
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
        } catch {
            showToast('error', 'Erro ao excluir cliente');
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
                    <Link to="/clientes" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 text-white font-medium no-underline">👥 Clientes</Link>
                    <Link to="/produtos" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline">📦 Produtos</Link>
                    <Link to="/pedidos" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline">📋 Pedidos</Link>
                </nav>

                <div className="p-4 border-t border-slate-800 mt-auto">
                    <div className="flex items-center gap-3 px-3 pt-2 mb-0">
                        <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                            {user?.nome?.[0]?.toUpperCase() || 'U'}
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
                    <Link to="/clientes" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 text-white font-medium no-underline">👥 Clientes</Link>
                    <Link to="/produtos" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition text-slate-300 no-underline">📦 Produtos</Link>
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
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">👥 Clientes</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <input
                            type="text"
                            placeholder="Buscar por nome ou CPF/CNPJ..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-80 px-5 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:border-indigo-500 text-sm"
                        />
                        <button
                            onClick={() => abrirModal()}
                            className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-medium flex items-center gap-2"
                        >
                            + Novo Cliente
                        </button>
                    </div>
                </header>

                {/* CONTEÚDO COM SCROLL */}
                <div className="p-6 md:p-8 flex-1 overflow-auto">
                    <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-4 text-left">Nome / Razão Social</th>
                                <th className="px-6 py-4 text-left">Tipo</th>
                                <th className="px-6 py-4 text-left">CPF / CNPJ</th>
                                <th className="px-6 py-4 text-left">E-mail</th>
                                <th className="px-6 py-4 text-left">Telefone</th>
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
                                    <td className="px-6 py-4 text-center space-x-4">
                                        <button onClick={() => abrirModal(cliente)} className="text-indigo-600 hover:text-indigo-700">Editar</button>
                                        <button onClick={() => confirmarExclusao(cliente.id)} className="text-red-600 hover:text-red-700">Excluir</button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal Novo / Editar Cliente */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl w-full max-w-lg mx-4 p-8">
                        <h2 className="text-2xl font-semibold mb-6">
                            {editandoId ? 'Editar Cliente' : 'Novo Cliente'}
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

                            <div className="grid grid-cols-2 gap-4">
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

                            <div className="flex gap-4 pt-4">
                                <button onClick={fecharModal} className="flex-1 py-3.5 border border-gray-300 rounded-2xl font-medium">Cancelar</button>
                                <button onClick={salvarCliente} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl font-medium hover:bg-indigo-700">Salvar</button>
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

export default Clientes;