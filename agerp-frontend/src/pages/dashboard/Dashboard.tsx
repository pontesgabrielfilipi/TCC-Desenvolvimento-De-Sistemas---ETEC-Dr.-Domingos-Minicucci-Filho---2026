import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardService } from '../../services/dashboardService';
import * as XLSX from 'xlsx';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface DashboardData {
    totalClientes: number;
    totalProdutos: number;
    vendasMes: number;
    pedidosPendentes: number;
    produtosEstoqueBaixo: number;

    vendasMensais: Array<{ mes: string; valor: number }>;
    topProdutos: Array<{ nome: string; vendas: number }>;
    distribuicaoClientes: Array<{ name: string; value: number }>;
    statusPedidos: Array<{ name: string; value: number }>;
    estoqueBaixo: Array<{ nome: string; quantidade: number }>;
}

const Dashboard = () => {
    const { user, logout } = useAuth();

    const [data, setData] = useState<DashboardData>({
        totalClientes: 0,
        totalProdutos: 0,
        vendasMes: 0,
        pedidosPendentes: 0,
        produtosEstoqueBaixo: 0,
        vendasMensais: [],
        topProdutos: [],
        distribuicaoClientes: [],
        statusPedidos: [],
        estoqueBaixo: []
    });

    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const carregarDashboard = async () => {
        try {
            setLoading(true);
            const response = await dashboardService.getRelatorioCompleto();
            setData(response.data);
        } catch (error) {
            console.error("Erro ao carregar dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDashboard();
    }, []);

    const formatarMoeda = (valor: number) => {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // ====================== EXPORTAÇÃO EXCEL ======================
    const exportarVendasDoMes = () => {
        const dados = [
            { Descricao: 'Total do Mês', Valor: data.vendasMes },
            ...data.vendasMensais.map(item => ({ Descricao: item.mes, Valor: item.valor }))
        ];
        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Vendas do Mês");
        XLSX.writeFile(wb, `Vendas_do_Mes_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const exportarClientesInativos = () => {
        const dados = [
            { Item: 'Total de Clientes', Valor: data.totalClientes },
            ...data.distribuicaoClientes.map(item => ({
                Item: item.name,
                Valor: item.value
            }))
        ];
        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Clientes Inativos");
        XLSX.writeFile(wb, `Clientes_Inativos_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const exportarEstoqueBaixo = () => {
        const dados = data.estoqueBaixo.length > 0
            ? data.estoqueBaixo.map(item => ({
                Produto: item.nome,
                Quantidade_Atual: item.quantidade
            }))
            : [{ Produto: "Nenhum produto com estoque baixo no momento", Quantidade_Atual: 0 }];

        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Estoque Baixo");
        XLSX.writeFile(wb, `Estoque_Baixo_${new Date().toISOString().slice(0,10)}.xlsx`);
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
                    <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 text-white font-medium no-underline">📊 Dashboard</Link>
                    <Link to="/clientes" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-slate-300 no-underline">👥 Clientes</Link>
                    <Link to="/produtos" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-slate-300 no-underline">📦 Produtos</Link>
                    <Link to="/pedidos" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-slate-300 no-underline">📋 Pedidos</Link>
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
                    <Link to="/dashboard" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 text-white font-medium no-underline">📊 Dashboard</Link>
                    <Link to="/clientes" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-slate-300 no-underline">👥 Clientes</Link>
                    <Link to="/produtos" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-slate-300 no-underline">📦 Produtos</Link>
                    <Link to="/pedidos" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-slate-300 no-underline">📋 Pedidos</Link>
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
                <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-3xl text-gray-700">☰</button>
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    </div>

                    <div className={"flex flex-row gap-2 "}>
                        {/* Relatórios - Apenas Desktop (PC) */}
                        <div className="hidden lg:flex gap-2">
                            <button onClick={exportarVendasDoMes} className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg px-2.5 py-2.5 bg-gay-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300">📄 Vendas do Mês</button>
                            <button onClick={exportarClientesInativos} className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg px-2.5 py-2.5 bg-gay-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300">👥 Clientes Inativos</button>
                            <button onClick={exportarEstoqueBaixo} className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg px-2.5 py-2.5 bg-gay-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300">📦 Estoque Baixo</button>
                        </div>

                        <button onClick={carregarDashboard} className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg px-3 py-2.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700">Atualizar</button>
                    </div>
                </header>

                {/* Relatórios - Mobile / Tablet */}
                <div className="lg:hidden bg-white border-b px-6 py-3">
                    <div className="flex flex-wrap gap-3 overflow-x-auto pb-1">
                        <button onClick={exportarVendasDoMes} className="flex-1 min-w-[140px] px-5 py-3 bg-gay-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300 transition">📄 Vendas do Mês</button>
                        <button onClick={exportarClientesInativos} className="flex-1 min-w-[140px] px-5 py-3 bg-gay-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300 transition">👥 Clientes Inativos</button>
                        <button onClick={exportarEstoqueBaixo} className="flex-1 min-w-[140px] px-5 py-3 bg-gay-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300 transition">📦 Estoque Baixo</button>
                    </div>
                </div>

                {/* CONTEÚDO COM SCROLL */}
                <div className="p-6 md:p-8 flex-1 overflow-auto">
                    {loading ? (
                        <p className="text-center text-gray-500 py-10">Carregando estatísticas...</p>
                    ) : (
                        <>
                            {/* CARDS */}
                                <div className="grid lg:flex md:flex flex-wrap grid-cols-1 gap-6 w-full justify-evenly">
                                    <div className="bg-white rounded-3xl p-6 shadow flex items-center justify-between flex-1">
                                        <div>
                                            <p className="text-gray-500 text-sm">Total Clientes</p>
                                            <p className="text-4xl font-bold mt-2">{data.totalClientes}</p>
                                        </div>
                                        <div className="text-6xl text-blue-500">👥</div>
                                    </div>

                                    <div className="bg-white rounded-3xl p-6 shadow flex items-center justify-between flex-1">
                                        <div>
                                            <p className="text-gray-500 text-sm">Vendas do Mês</p>
                                            <p className="text-4xl font-bold mt-2">{formatarMoeda(data.vendasMes)}</p>
                                        </div>
                                        <div className="text-6xl text-green-500">💰</div>
                                    </div>

                                    <div className="bg-white rounded-3xl p-6 shadow flex items-center justify-between flex-1">
                                        <div>
                                            <p className="text-gray-500 text-sm">Produtos em Estoque</p>
                                            <p className="text-4xl font-bold mt-2">{data.totalProdutos}</p>
                                        </div>
                                        <div className="text-6xl text-amber-500">📦</div>
                                    </div>

                                    <div className="bg-white rounded-3xl p-6 shadow flex items-center justify-between flex-1">
                                        <div>
                                            <p className="text-gray-500 text-sm">Pedidos Pendentes</p>
                                            <p className="text-4xl font-bold mt-2">{data.pedidosPendentes}</p>
                                        </div>
                                        <div className="text-6xl text-orange-500">📋</div>
                                    </div>

                                    <div className="bg-white rounded-3xl p-6 shadow flex items-center justify-between flex-1">
                                        <div>
                                            <p className="text-gray-500 text-sm">Estoque Baixo</p>
                                            <p className="text-4xl font-bold mt-2 text-red-600">{data.produtosEstoqueBaixo}</p>
                                        </div>
                                        <div className="text-6xl text-red-500">⚠️</div>
                                    </div>
                                </div>

                            {/* GRÁFICOS */}
                                <div className="mt-10">
                                    <div className={"border-y-2 my-4 p-3 flex mx-auto"}>
                                        <h2 className="mx-auto text-3xl font-semibold text-gray-800">Visão Geral</h2>
                                    </div>

                                    <div className="grid lg:flex md:flex flex-wrap grid-cols-1 gap-8 justify-content-center">
                                        <div className="bg-white rounded-3xl p-6 shadow">
                                            <h3 className="font-medium mb-4">Evolução de Vendas (últimos 6 meses)</h3>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <LineChart data={data.vendasMensais}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="mes" />
                                                    <YAxis />
                                                    <Tooltip formatter={(value: unknown) => formatarMoeda(Number(value))} />
                                                    <Line type="monotone" dataKey="valor" stroke="#4f46e5" strokeWidth={3} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <div className="bg-white rounded-3xl p-6 shadow">
                                            <h3 className="font-medium mb-4">Top 5 Produtos Mais Vendidos</h3>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart data={data.topProdutos} layout="vertical">
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis type="number" />
                                                    <YAxis dataKey="nome" type="category" width={140} />
                                                    <Tooltip />
                                                    <Bar dataKey="vendas" fill="#4f46e5" radius={8} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="bg-white rounded-3xl p-6 shadow">
                                            <h3 className="font-medium mb-4">Distribuição de Clientes</h3>
                                            <ResponsiveContainer width="100%" height={280}>
                                                <PieChart>
                                                    <Pie data={data.distribuicaoClientes} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                                        {data.distribuicaoClientes.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.name.includes('Física') ? '#3b82f6' : '#8b5cf6'} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <div className="bg-white rounded-3xl p-6 shadow">
                                            <h3 className="font-medium mb-4">Status dos Pedidos</h3>
                                            <ResponsiveContainer width="100%" height={280}>
                                                <PieChart>
                                                    <Pie data={data.statusPedidos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                                        {data.statusPedidos.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.name === 'PENDENTE' ? '#f59e0b' : entry.name === 'EM_ANDAMENTO' ? '#10b981' : '#3b82f6'} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <div className="bg-white rounded-3xl p-6 shadow">
                                            <h3 className="font-medium mb-4">Produtos com Estoque Baixo</h3>
                                            <ResponsiveContainer width="100%" height={280}>
                                                <BarChart data={data.estoqueBaixo}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="nome" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Bar dataKey="quantidade" fill="#ef4444" radius={8} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
