import { useEffect, useState } from 'react';
import { dashboardService } from '../../services/dashboardService';
import { useAparenciaSistema } from '../../hooks/useAparenciaSistema';
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

const STATUS_PEDIDO_META: Record<string, { label: string; color: string }> = {
    PENDENTE: { label: 'Pendente', color: '#f59e0b' },
    CONFIRMADO: { label: 'Confirmado', color: '#2563eb' },
    EM_PREPARACAO: { label: 'Em preparação', color: '#7c3aed' },
    PRONTO: { label: 'Pronto', color: '#0891b2' },
    ENTREGUE: { label: 'Entregue', color: '#059669' },
    CANCELADO: { label: 'Cancelado', color: '#e11d48' },
    EM_ANDAMENTO: { label: 'Em andamento', color: '#4f46e5' },
    EM_PROCESSAMENTO: { label: 'Em processamento', color: '#2563eb' },
    ENVIADO: { label: 'Enviado', color: '#7c3aed' },
    SEPARADO: { label: 'Separado', color: '#0891b2' },
};

const CORES_STATUS_DESCONHECIDO = ['#475569', '#0f766e', '#a16207', '#be123c', '#6d28d9'];

const normalizarChaveStatus = (status: string) => status.trim().toUpperCase().replace(/[\s-]+/g, '_');

const formatarStatus = (status: string) => STATUS_PEDIDO_META[status]?.label
    ?? status.toLocaleLowerCase('pt-BR').replaceAll('_', ' ').replace(/^./, letra => letra.toLocaleUpperCase('pt-BR'));

const corDoStatus = (status: string) => {
    const corConhecida = STATUS_PEDIDO_META[status]?.color;
    if (corConhecida) return corConhecida;
    const indice = [...status].reduce((total, caractere) => total + caractere.charCodeAt(0), 0);
    return CORES_STATUS_DESCONHECIDO[indice % CORES_STATUS_DESCONHECIDO.length];
};

const numeroNaoNegativo = (valor: unknown): number | null => {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= 0 ? numero : null;
};

const normalizarSerie = (valor: unknown, chaveNome: string, chaveValor: string) => {
    if (!Array.isArray(valor)) return [];
    return valor.flatMap(item => {
        if (!item || typeof item !== 'object') return [];
        const registro = item as Record<string, unknown>;
        const nome = typeof registro[chaveNome] === 'string' ? registro[chaveNome].trim() : '';
        const quantidade = numeroNaoNegativo(registro[chaveValor]);
        return nome && quantidade !== null ? [{ [chaveNome]: nome, [chaveValor]: quantidade }] : [];
    });
};

const normalizarDashboard = (payload: unknown): DashboardData => {
    const valor = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    return {
        totalClientes: numeroNaoNegativo(valor.totalClientes) ?? 0,
        totalProdutos: numeroNaoNegativo(valor.totalProdutos) ?? 0,
        vendasMes: numeroNaoNegativo(valor.vendasMes) ?? 0,
        pedidosPendentes: numeroNaoNegativo(valor.pedidosPendentes) ?? 0,
        produtosEstoqueBaixo: numeroNaoNegativo(valor.produtosEstoqueBaixo) ?? 0,
        vendasMensais: normalizarSerie(valor.vendasMensais, 'mes', 'valor') as DashboardData['vendasMensais'],
        topProdutos: normalizarSerie(valor.topProdutos, 'nome', 'vendas') as DashboardData['topProdutos'],
        distribuicaoClientes: normalizarSerie(valor.distribuicaoClientes, 'name', 'value') as DashboardData['distribuicaoClientes'],
        statusPedidos: normalizarSerie(valor.statusPedidos, 'name', 'value') as DashboardData['statusPedidos'],
        estoqueBaixo: normalizarSerie(valor.estoqueBaixo, 'nome', 'quantidade') as DashboardData['estoqueBaixo'],
    };
};

const Dashboard = () => {
    const { exibirAlertasEstoque } = useAparenciaSistema();

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
    const [feedback, setFeedback] = useState('');

    const carregarDashboard = async (refresh = false) => {
        try {
            setLoading(true);
            setFeedback('');
            const response = await dashboardService.getRelatorioCompleto(refresh);
            setData(normalizarDashboard(response.data));
            if (refresh) setFeedback('Dados atualizados com sucesso.');
        } catch (error) {
            console.error("Erro ao carregar dashboard:", error);
            setFeedback('Não foi possível atualizar os dados.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDashboard();
        const atualizar = () => { void carregarDashboard(); };
        window.addEventListener('agerp:configuracoes-atualizadas', atualizar);
        return () => window.removeEventListener('agerp:configuracoes-atualizadas', atualizar);
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

    const statusPedidos = Array.from(data.statusPedidos.reduce((statusAgrupados, item) => {
        const status = normalizarChaveStatus(item.name);
        if (!status || item.value <= 0) return statusAgrupados;
        statusAgrupados.set(status, (statusAgrupados.get(status) ?? 0) + item.value);
        return statusAgrupados;
    }, new Map<string, number>())).map(([name, value]) => ({
        name,
        value,
        label: formatarStatus(name),
        color: corDoStatus(name),
    }));
    const totalStatusPedidos = statusPedidos.reduce((total, item) => total + item.value, 0);

    return (
        <div className="h-full min-w-0 bg-slate-100 flex overflow-hidden">

            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* HEADER */}
                <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    </div>

                    <div className={"flex flex-row gap-2 "}>
                        {/* Relatórios - Apenas Desktop (PC) */}
                        <div className="hidden lg:flex gap-2">
                            <button onClick={exportarVendasDoMes} className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg px-2.5 py-2.5 bg-gay-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300">📄 Vendas do Mês</button>
                            <button onClick={exportarClientesInativos} className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg px-2.5 py-2.5 bg-gay-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300">👥 Clientes Inativos</button>
                            <button onClick={exportarEstoqueBaixo} className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg px-2.5 py-2.5 bg-gay-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300">📦 Estoque Baixo</button>
                        </div>

                        <button onClick={() => void carregarDashboard(true)} disabled={loading} className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg px-3 py-2.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50">{loading ? 'Atualizando...' : '↻ Atualizar'}</button>
                    </div>
                </header>

                {/* Relatórios - Mobile / Tablet */}
                <div className="lg:hidden bg-white border-b px-4 py-3 sm:px-6">
                    <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
                        <button onClick={exportarVendasDoMes} className="min-w-[150px] shrink-0 px-5 py-3 bg-gay-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300 transition sm:min-w-0">📄 Vendas do Mês</button>
                        <button onClick={exportarClientesInativos} className="min-w-[150px] shrink-0 px-5 py-3 bg-gay-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300 transition sm:min-w-0">👥 Clientes Inativos</button>
                        <button onClick={exportarEstoqueBaixo} className="min-w-[150px] shrink-0 px-5 py-3 bg-gay-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300 transition sm:min-w-0">📦 Estoque Baixo</button>
                    </div>
                </div>

                {/* CONTEÚDO COM SCROLL */}
                <div className="flex-1 overflow-auto bg-slate-100 p-4 sm:p-6 md:p-8">
                    {feedback && <p role="status" className="mb-4 text-sm text-gray-600">{feedback}</p>}
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

                                    {exibirAlertasEstoque && <div className="bg-white rounded-3xl p-6 shadow flex items-center justify-between flex-1">
                                        <div>
                                            <p className="text-gray-500 text-sm">Estoque Baixo</p>
                                            <p className="text-4xl font-bold mt-2 text-red-600">{data.produtosEstoqueBaixo}</p>
                                        </div>
                                        <div className="text-6xl text-red-500">⚠️</div>
                                    </div>}
                                </div>

                            {/* GRÁFICOS */}
                                <div className="mt-10">
                                    <div className={"border-y-2 my-4 p-3 flex mx-auto"}>
                                        <h2 className="mx-auto text-3xl font-semibold text-gray-800">Visão Geral</h2>
                                    </div>

                                    <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
                                        <div className="min-w-0 bg-white rounded-3xl p-6 shadow">
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

                                        <div className="min-w-0 bg-white rounded-3xl p-6 shadow">
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
                                        <div className="min-w-0 bg-white rounded-3xl p-6 shadow">
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

                                        <div className="min-w-0 bg-white rounded-3xl p-4 shadow sm:p-6">
                                            <h3 className="font-medium mb-4">Status dos Pedidos</h3>
                                            {statusPedidos.length > 0 ? <>
                                                <div className="h-56 w-full min-w-0 sm:h-64" aria-label={`Distribuição de ${totalStatusPedidos.toLocaleString('pt-BR')} pedidos por status`}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                                                            <Pie
                                                                data={statusPedidos}
                                                                dataKey="value"
                                                                nameKey="label"
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius="48%"
                                                                outerRadius="78%"
                                                                paddingAngle={2}
                                                                stroke="#ffffff"
                                                                strokeWidth={2}
                                                            >
                                                                {statusPedidos.map(item => (
                                                                    <Cell key={item.name} fill={item.color} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip
                                                                formatter={(value: unknown, name: unknown) => {
                                                                    const quantidade = Number(value);
                                                                    const percentual = totalStatusPedidos > 0 ? (quantidade / totalStatusPedidos) * 100 : 0;
                                                                    return [`${quantidade.toLocaleString('pt-BR')} pedido${quantidade === 1 ? '' : 's'} (${percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`, String(name)];
                                                                }}
                                                            />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <p className="mb-3 text-center text-sm text-slate-500">
                                                    Total: <span className="font-semibold text-slate-700">{totalStatusPedidos.toLocaleString('pt-BR')}</span>
                                                </p>
                                                <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2" aria-label="Legenda dos status dos pedidos">
                                                    {statusPedidos.map(item => {
                                                        const percentual = (item.value / totalStatusPedidos) * 100;
                                                        return <li key={item.name} className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                                                            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                                                            <span className="min-w-0 flex-1 break-words text-slate-700">{item.label}</span>
                                                            <span className="shrink-0 font-semibold tabular-nums text-slate-900">{item.value.toLocaleString('pt-BR')} <span className="font-normal text-slate-500">({percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)</span></span>
                                                        </li>;
                                                    })}
                                                </ul>
                                            </> : <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-50 px-4 text-center text-sm text-slate-500" role="status">
                                                Nenhum pedido com status contabilizável.
                                            </div>}
                                        </div>

                                        {exibirAlertasEstoque && <div className="min-w-0 bg-white rounded-3xl p-6 shadow">
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
                                        </div>}
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
