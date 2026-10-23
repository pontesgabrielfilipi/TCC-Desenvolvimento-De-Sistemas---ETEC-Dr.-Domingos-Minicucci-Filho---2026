import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMobileHeaderActionTarget } from '../../components/navigation/MobileHeaderActionContext';
import { dashboardService } from '../../services/dashboardService';
import { useAparenciaSistema } from '../../hooks/useAparenciaSistema';
import { IndicatorCard } from '../../components/indicators/IndicatorCard';
import * as XLSX from 'xlsx';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
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

// O endpoint do dashboard devolve nomes de categorias, não os códigos de cadastro.
const CORES_CLIENTES: Record<string, string> = {
    'Pessoa Física': '#3b82f6',
    'Pessoa Jurídica': '#8b5cf6',
    'Não informado': '#64748b',
};
const ORDEM_CLIENTES = ['Pessoa Física', 'Pessoa Jurídica', 'Não informado'];
const formatarPercentual = (quantidade: number, total: number) =>
    (total > 0 ? (quantidade / total) * 100 : 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

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

// Rótulos curtos mantêm o eixo legível até no celular; o tooltip exibe o valor completo.
const formatoEixoVendas = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
});
const formatarEixoVendas = (valor: number) => formatoEixoVendas.format(valor);

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
    const mobileHeaderActionTarget = useMobileHeaderActionTarget();
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

    const exportarEstoqueBaixo = async () => {
        try {
            setFeedback('');
            const { data: estoqueAtual } = await dashboardService.listarEstoqueBaixo();
            const dados = estoqueAtual.length > 0
                ? estoqueAtual.map(item => ({
                    Produto: item.nome,
                    Quantidade_Atual: item.quantidade,
                    Minimo_Aplicado: item.minimo
                }))
                : [{ Produto: 'Nenhum produto com estoque baixo no momento', Quantidade_Atual: 0, Minimo_Aplicado: 0 }];

            const ws = XLSX.utils.json_to_sheet(dados);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Estoque Baixo');
            XLSX.writeFile(wb, `Estoque_Baixo_${new Date().toISOString().slice(0,10)}.xlsx`);
        } catch (error) {
            console.error('Erro ao exportar estoque baixo:', error);
            setFeedback('Não foi possível exportar o estoque baixo. Atualize e tente novamente.');
        }
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

    const distribuicaoClientes = Array.from(data.distribuicaoClientes.reduce((agrupados, item) => {
        if (item.value > 0) agrupados.set(item.name, (agrupados.get(item.name) ?? 0) + item.value);
        return agrupados;
    }, new Map<string, number>())).map(([name, value]) => ({
        name,
        value,
        color: CORES_CLIENTES[name] ?? '#64748b',
    })).sort((a, b) => {
        const posicaoA = ORDEM_CLIENTES.indexOf(a.name);
        const posicaoB = ORDEM_CLIENTES.indexOf(b.name);
        return (posicaoA < 0 ? ORDEM_CLIENTES.length : posicaoA) -
            (posicaoB < 0 ? ORDEM_CLIENTES.length : posicaoB) || a.name.localeCompare(b.name, 'pt-BR');
    });
    const totalDistribuicaoClientes = distribuicaoClientes.reduce((total, item) => total + item.value, 0);

    return (
        <div data-testid="dashboard-page" className="h-full min-w-0 bg-app-background flex overflow-hidden">

            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {mobileHeaderActionTarget && createPortal(
                    <button type="button" aria-label="Atualizar Dashboard" onClick={() => void carregarDashboard(true)} disabled={loading} className="min-h-11 whitespace-nowrap rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
                        {loading ? 'Atualizando...' : '↻ Atualizar'}
                    </button>,
                    mobileHeaderActionTarget
                )}

                {/* HEADER */}
                <header className="hidden flex-wrap items-center justify-between gap-3 border-b bg-white px-3 py-4 sm:flex sm:px-6">
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-gray-900 sm:text-3xl">Dashboard</h1>
                    </div>

                    <div className="flex min-w-0 items-center gap-2">
                        {/* Relatórios - Apenas Desktop (PC) */}
                        <section aria-labelledby="dashboard-relatorios-desktop" className="hidden lg:flex flex-col gap-1">
                            <h2 id="dashboard-relatorios-desktop" className="text-xs font-semibold uppercase tracking-wide text-gray-600">Relatórios</h2>
                            <div className="flex gap-2">
                                <button onClick={exportarVendasDoMes} className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg px-2.5 py-2.5 bg-gray-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300">📄 Vendas do Mês</button>
                                <button onClick={exportarClientesInativos} className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg px-2.5 py-2.5 bg-gray-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300">👥 Clientes Inativos</button>
                                <button onClick={exportarEstoqueBaixo} className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg px-2.5 py-2.5 bg-gray-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300">📦 Estoque Baixo</button>
                            </div>
                        </section>

                        <button onClick={() => void carregarDashboard(true)} disabled={loading} className="min-h-11 whitespace-nowrap rounded-2xl bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white transition-all duration-300 ease-in-out hover:scale-105 hover:bg-indigo-700 hover:shadow-lg disabled:opacity-50">{loading ? 'Atualizando...' : '↻ Atualizar'}</button>
                    </div>
                </header>

                {/* Relatórios - Mobile / Tablet */}
                <section aria-labelledby="dashboard-relatorios-mobile" className="min-w-0 max-w-full border-b bg-white px-4 py-3 sm:px-6 lg:hidden">
                    <h2 id="dashboard-relatorios-mobile" className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Relatórios</h2>
                    <div
                        data-testid="dashboard-report-scroll"
                        role="group"
                        aria-label="Opções de relatórios"
                        tabIndex={0}
                        className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-1 sm:overflow-visible sm:overscroll-x-auto sm:pb-0"
                    >
                        <div className="flex w-max min-w-full gap-2 sm:grid sm:w-full sm:grid-cols-3">
                            <button onClick={exportarVendasDoMes} className="min-h-11 shrink-0 whitespace-nowrap rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm font-medium transition hover:bg-gray-300 sm:min-w-0 sm:whitespace-normal">📄 Vendas do Mês</button>
                            <button onClick={exportarClientesInativos} className="min-h-11 shrink-0 whitespace-nowrap rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm font-medium transition hover:bg-gray-300 sm:min-w-0 sm:whitespace-normal">👥 Clientes Inativos</button>
                            <button onClick={exportarEstoqueBaixo} className="min-h-11 shrink-0 whitespace-nowrap rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm font-medium transition hover:bg-gray-300 sm:min-w-0 sm:whitespace-normal">📦 Estoque Baixo</button>
                        </div>
                    </div>
                </section>

                {/* CONTEÚDO COM SCROLL */}
                <div data-testid="dashboard-scroll-surface" className="flex-1 overflow-auto bg-app-background p-4 sm:p-6 md:p-8">
                    {feedback && <p role="status" className="mb-4 text-sm text-gray-600">{feedback}</p>}
                    {loading ? (
                        <p className="text-center text-gray-500 py-10">Carregando estatísticas...</p>
                    ) : (
                        <>
                            {/* CARDS */}
                                <div className="agerp-indicator-grid">
                                    <IndicatorCard variant="dashboard" testId="dashboard-summary-card" label="Total Clientes" value={data.totalClientes} icon="👥" iconClassName="text-blue-500" />
                                    <IndicatorCard variant="dashboard" label="Vendas do Mês" value={formatarMoeda(data.vendasMes)} icon="💰" iconClassName="text-green-500" />
                                    <IndicatorCard variant="dashboard" label="Produtos em Estoque" value={data.totalProdutos} icon="📦" iconClassName="text-amber-500" />
                                    <IndicatorCard variant="dashboard" label="Pedidos Pendentes" value={data.pedidosPendentes} icon="📋" iconClassName="text-orange-500" />
                                    {exibirAlertasEstoque && <IndicatorCard variant="dashboard" label="Estoque Baixo" value={data.produtosEstoqueBaixo} icon="⚠️" iconClassName="text-red-500" valueClassName="text-red-600" />}
                                </div>

                            {/* GRÁFICOS */}
                                <div className="mt-8 sm:mt-10">
                                    <div className={"border-y-2 my-4 p-3 flex mx-auto"}>
                                        <h2 className="mx-auto text-2xl font-semibold text-gray-800 sm:text-3xl">Visão Geral</h2>
                                    </div>

                                    <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
                                        <div data-testid="dashboard-vendas-chart-card" className="min-w-0 rounded-3xl bg-white p-4 shadow sm:p-6">
                                            <h3 className="font-medium mb-4">Evolução de Vendas (últimos 6 meses)</h3>
                                            <div className="agerp-responsive-chart h-64 sm:h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={data.vendasMensais} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickMargin={8} minTickGap={10} interval="preserveStartEnd" />
                                                    <YAxis width="auto" tick={{ fontSize: 11 }} tickMargin={8} tickFormatter={formatarEixoVendas} />
                                                    <Tooltip formatter={(value: unknown) => formatarMoeda(Number(value))} />
                                                    <Line type="monotone" dataKey="valor" stroke="#4f46e5" strokeWidth={3} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                            </div>
                                        </div>

                                        <div className="min-w-0 rounded-3xl bg-white p-4 shadow sm:p-6">
                                            <h3 className="font-medium mb-4">Top 5 Produtos Mais Vendidos</h3>
                                            <div className="agerp-responsive-chart h-64 sm:h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={data.topProdutos} layout="vertical" margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis type="number" />
                                                    <YAxis dataKey="nome" type="category" width={96} tick={{ fontSize: 11 }} />
                                                    <Tooltip />
                                                    <Bar dataKey="vendas" fill="#4f46e5" radius={8} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                            </div>
                                        </div>
                                        <div data-testid="dashboard-clientes-chart-card" className="min-w-0 rounded-3xl bg-white p-4 shadow sm:p-6">
                                            <h3 className="font-medium mb-4">Distribuição de Clientes</h3>
                                            {totalDistribuicaoClientes > 0 ? (
                                                <div className="h-56 w-full min-w-0 sm:h-64" aria-label={`Clientes distribuídos: ${totalDistribuicaoClientes.toLocaleString('pt-BR')}`}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                                                            <Pie
                                                                data={distribuicaoClientes}
                                                                dataKey="value"
                                                                nameKey="name"
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius="48%"
                                                                outerRadius="78%"
                                                                paddingAngle={distribuicaoClientes.length > 1 ? 2 : 0}
                                                                stroke="#ffffff"
                                                                strokeWidth={2}
                                                            >
                                                                {distribuicaoClientes.map(item => (
                                                                    <Cell key={item.name} fill={item.color} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip content={({ active, payload }) => {
                                                                if (!active || !payload?.length) return null;
                                                                const nome = String(payload[0].name ?? '');
                                                                const item = distribuicaoClientes.find(categoria => categoria.name === nome);
                                                                if (!item) return null;
                                                                return <div data-testid="dashboard-clientes-tooltip" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
                                                                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                                                                    <span className="text-slate-700">{item.name}:</span>
                                                                    <span className="font-semibold tabular-nums text-slate-900">{item.value.toLocaleString('pt-BR')} ({formatarPercentual(item.value, totalDistribuicaoClientes)}%)</span>
                                                                </div>;
                                                            }} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            ) : <div className="flex h-56 items-center justify-center rounded-2xl bg-slate-50 px-4 text-center text-sm text-slate-500 sm:h-64" role="status">
                                                Nenhum cliente para exibir.
                                            </div>}
                                            <p className="mb-3 text-center text-sm text-slate-500">
                                                Total: <span className="font-semibold text-slate-700">{totalDistribuicaoClientes.toLocaleString('pt-BR')}</span>
                                            </p>
                                            {distribuicaoClientes.length > 0 && <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2" aria-label="Legenda da distribuição de clientes">
                                                {distribuicaoClientes.map(item => <li key={item.name} className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                                                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                                                    <span className="min-w-0 flex-1 break-words text-slate-700">{item.name}</span>
                                                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{item.value.toLocaleString('pt-BR')} <span className="font-normal text-slate-500">({formatarPercentual(item.value, totalDistribuicaoClientes)}%)</span></span>
                                                </li>)}
                                            </ul>}
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

                                        {exibirAlertasEstoque && <div className="min-w-0 rounded-3xl bg-white p-4 shadow sm:p-6">
                                            <h3 className="font-medium mb-4">Produtos com Estoque Baixo</h3>
                                            <div className="agerp-responsive-chart h-64 sm:h-[280px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={data.estoqueBaixo} layout="vertical" margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis type="number" />
                                                    <YAxis dataKey="nome" type="category" width={96} tick={{ fontSize: 11 }} />
                                                    <Tooltip />
                                                    <Bar dataKey="quantidade" fill="#ef4444" radius={8} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                            </div>
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
