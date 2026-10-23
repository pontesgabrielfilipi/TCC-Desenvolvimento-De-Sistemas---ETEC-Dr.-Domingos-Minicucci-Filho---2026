import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EvolucaoCliente } from '../../services/adminEstatisticasService';

interface ClientOrdersChartProps {
    evolucao: EvolucaoCliente[];
}

// Matizes diferentes ajudam a relacionar cada linha à legenda mesmo com muitos clientes.
const corCliente = (indice: number) => `hsl(${Math.round((indice * 137.508) % 360)} 65% 38%)`;

export function ClientOrdersChart({ evolucao }: ClientOrdersChartProps) {
    const [clientesOcultos, setClientesOcultos] = useState<number[]>([]);

    const clientes = useMemo(() => Array.from(
        new Map(evolucao.map(item => [item.id, item.nome])).entries(),
        ([id, nome], indice) => ({ id, nome, cor: corCliente(indice) }),
    ), [evolucao]);

    const dados = useMemo(() => {
        const periodos = new Map<string, Record<string, string | number>>();
        for (const item of evolucao) {
            const periodo = periodos.get(item.periodo) ?? { periodo: item.periodo };
            periodo[`cliente_${item.id}`] = item.pedidos;
            periodos.set(item.periodo, periodo);
        }
        return Array.from(periodos.values());
    }, [evolucao]);

    if (evolucao.length === 0) {
        return <div className="py-12 text-center text-sm text-gray-500">Sem evolução de clientes no período.</div>;
    }

    return (
        <div className="min-w-0" data-testid="client-orders-chart">
            <div className="agerp-responsive-chart h-72" data-testid="client-orders-plot">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} width={36} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        {clientes.filter(cliente => !clientesOcultos.includes(cliente.id)).map(cliente => (
                            <Line key={cliente.id} type="monotone" dataKey={`cliente_${cliente.id}`}
                                name={cliente.nome} stroke={cliente.cor} strokeWidth={1.75} dot={false} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Fora do ResponsiveContainer: a legenda nunca modifica a altura útil do gráfico. */}
            <div className="mt-4 min-w-0 border-t border-gray-100 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <h4 className="text-sm font-semibold text-gray-700">Clientes no gráfico ({clientes.length})</h4>
                    {clientesOcultos.length > 0 && (
                        <button type="button" onClick={() => setClientesOcultos([])}
                            className="text-xs font-medium text-indigo-700 hover:underline">Mostrar todos</button>
                    )}
                </div>
                <p className="mt-1 text-xs text-gray-500">Selecione um cliente para mostrar ou ocultar sua linha.</p>
                <div className="mt-2 max-h-44 min-w-0 overflow-y-auto overscroll-contain rounded-xl border border-gray-200 p-2"
                    role="group" aria-label="Legenda dos clientes" tabIndex={0} data-testid="client-orders-legend">
                    <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2">
                        {clientes.map(cliente => {
                            const visivel = !clientesOcultos.includes(cliente.id);
                            return (
                                <button key={cliente.id} type="button" aria-pressed={visivel}
                                    onClick={() => setClientesOcultos(atuais => visivel ? [...atuais, cliente.id] : atuais.filter(id => id !== cliente.id))}
                                    className={`flex min-w-0 items-start gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-gray-50 ${visivel ? 'text-gray-800' : 'text-gray-400'}`}>
                                    <span className="mt-1 h-0.5 w-5 shrink-0 rounded" style={{ backgroundColor: cliente.cor, opacity: visivel ? 1 : 0.3 }} aria-hidden="true" />
                                    <span className="min-w-0 break-words [overflow-wrap:anywhere]">{cliente.nome}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
