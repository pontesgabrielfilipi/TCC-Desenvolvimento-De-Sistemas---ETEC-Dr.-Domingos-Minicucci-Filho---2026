// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { configuracoesService } from '../../services/configuracoesService';
import type { ConfiguracoesSistema, DiagnosticoSistema } from '../../services/configuracoesService';
import { getHttpErrorMessage } from '../../utils/httpError';
import GerenciamentoCargos from './GerenciamentoCargos';

export default function AdminConfiguracoes() {
    const [salvo, setSalvo] = useState<ConfiguracoesSistema | null>(null);
    const [form, setForm] = useState<ConfiguracoesSistema | null>(null);
    const [diagnostico, setDiagnostico] = useState<DiagnosticoSistema | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');
    const [sucesso, setSucesso] = useState('');

    const carregar = async () => {
        setCarregando(true);
        setErro('');
        try {
            const { data } = await configuracoesService.consultar();
            setSalvo(data);
            setForm(data);
        } catch (e) {
            setErro(getHttpErrorMessage(e, 'Não foi possível carregar as configurações.'));
        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => {
        void carregar();
        void configuracoesService.diagnostico().then(({ data }) => setDiagnostico(data)).catch(() => setDiagnostico(null));
    }, []);

    const modificado = !!salvo && !!form && (
        salvo.nomeEmpresa !== form.nomeEmpresa ||
        salvo.limiteEstoqueBaixo !== form.limiteEstoqueBaixo ||
        salvo.usarEstoqueMinimoGeral !== form.usarEstoqueMinimoGeral ||
        salvo.exibirAlertasEstoque !== form.exibirAlertasEstoque ||
        salvo.timeoutIaMs !== form.timeoutIaMs
    );

    const salvar = async (event: FormEvent) => {
        event.preventDefault();
        if (!form || !modificado || salvando) return;
        setErro('');
        setSucesso('');
        if (!form.nomeEmpresa.trim() || form.nomeEmpresa.trim().length > 100) {
            setErro('O nome da empresa deve ter de 1 a 100 caracteres.');
            return;
        }
        if (!Number.isInteger(form.limiteEstoqueBaixo) || form.limiteEstoqueBaixo < 1 || form.limiteEstoqueBaixo > 100000 ||
            !Number.isInteger(form.timeoutIaMs) || form.timeoutIaMs < 500 || form.timeoutIaMs > 15000) {
            setErro('Verifique o limite de estoque (1–100000) e o timeout da IA (500–15000 ms).');
            return;
        }
        if ((form.limiteEstoqueBaixo !== salvo?.limiteEstoqueBaixo ||
            form.usarEstoqueMinimoGeral !== salvo?.usarEstoqueMinimoGeral ||
            form.timeoutIaMs !== salvo?.timeoutIaMs) &&
            !window.confirm('Alterar estes parâmetros afeta os indicadores de estoque e as próximas previsões de entrega. Confirmar?')) return;

        setSalvando(true);
        try {
            const { data } = await configuracoesService.atualizar({
                nomeEmpresa: form.nomeEmpresa.trim(),
                limiteEstoqueBaixo: form.limiteEstoqueBaixo,
                usarEstoqueMinimoGeral: form.usarEstoqueMinimoGeral,
                exibirAlertasEstoque: form.exibirAlertasEstoque,
                timeoutIaMs: form.timeoutIaMs,
                versao: form.versao,
            });
            setSalvo(data);
            setForm(data);
            setSucesso('Configurações salvas. As alterações já estão em vigor.');
            configuracoesService.notificarMudanca();
            void configuracoesService.diagnostico().then(({ data: d }) => setDiagnostico(d)).catch(() => setDiagnostico(null));
        } catch (e) {
            setErro(getHttpErrorMessage(e, 'Não foi possível salvar. Se houve outra edição, recarregue antes de tentar novamente.'));
        } finally {
            setSalvando(false);
        }
    };

    if (carregando) return <div className="space-y-8"><div className="rounded-2xl bg-white p-10 text-gray-600" role="status">Carregando configurações...</div><GerenciamentoCargos /></div>;
    if (!form) return <div className="space-y-8"><div className="rounded-2xl bg-white p-8"><p role="alert" className="text-red-700">{erro || 'Configurações indisponíveis.'}</p><button className="mt-4 rounded-xl border px-4 py-2" onClick={() => void carregar()}>Tentar novamente</button></div><GerenciamentoCargos /></div>;

    return <div className="min-w-0 space-y-8"><form onSubmit={salvar} className="max-w-5xl min-w-0 space-y-5 pb-8">
        <div><h2 className="text-xl font-semibold text-gray-900">Configurações do sistema</h2><p className="mt-1 text-sm text-gray-500">Alterações persistidas no banco de dados, aplicadas sem reiniciar o servidor.</p></div>
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6 space-y-4" aria-labelledby="config-gerais">
            <h3 id="config-gerais" className="text-lg font-semibold">Geral</h3>
            <label className="block text-sm font-medium">Nome de exibição da empresa
                <input required maxLength={100} value={form.nomeEmpresa} onChange={e => setForm({ ...form, nomeEmpresa: e.target.value })} className="mt-2 block w-full rounded-xl border border-gray-300 p-3 focus-visible:outline-indigo-600" />
                <span className="mt-1 block text-xs font-normal text-gray-500">Exibido na navegação das páginas autenticadas.</span>
            </label>
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6 space-y-4" aria-labelledby="config-estoque">
            <h3 id="config-estoque" className="text-lg font-semibold">Estoque</h3>
            <label className="flex items-start gap-3 text-sm font-medium">
                <input type="checkbox" checked={form.usarEstoqueMinimoGeral} onChange={e => setForm({ ...form, usarEstoqueMinimoGeral: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-indigo-600" />
                <span>Usar estoque mínimo geral
                    <span className="mt-1 block text-xs font-normal text-gray-500">Habilitada: limite geral em todos os produtos. Desabilitada: mínimos individuais. A troca preserva os limites cadastrados.</span>
                </span>
            </label>
            <label className="block text-sm font-medium">Limite geral de estoque baixo (unidades inteiras)
                <input required type="number" min={1} max={100000} step={1} value={form.limiteEstoqueBaixo} onChange={e => setForm({ ...form, limiteEstoqueBaixo: Number(e.target.value) })} className="mt-2 block w-full rounded-xl border border-gray-300 p-3" />
                <span className="mt-1 block text-xs font-normal text-gray-500">{form.usarEstoqueMinimoGeral ? 'Limite aplicado a todos os produtos.' : 'Limite preservado para quando o modo geral for reativado.'} O alerta considera a quantidade estritamente inferior ao mínimo. Registros sem mínimo individual usam 10 unidades.</span>
                <span className="mt-1 block text-xs font-normal text-gray-500">Produtos com quantidade inferior ao limite entram nos indicadores administrativos e do dashboard. Não altera o mínimo cadastrado por produto.</span>
            </label>
            <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={form.exibirAlertasEstoque} onChange={e => setForm({ ...form, exibirAlertasEstoque: e.target.checked })} className="h-5 w-5 accent-indigo-600" />Exibir alertas e gráfico de estoque baixo no dashboard</label>
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6 space-y-4" aria-labelledby="config-ia">
            <h3 id="config-ia" className="text-lg font-semibold">Inteligência artificial</h3>
            <label className="block text-sm font-medium">Timeout da API de previsão (ms)
                <input required type="number" min={500} max={15000} step={100} value={form.timeoutIaMs} onChange={e => setForm({ ...form, timeoutIaMs: Number(e.target.value) })} className="mt-2 block w-full rounded-xl border border-gray-300 p-3" />
                <span className="mt-1 block text-xs font-normal text-gray-500">Tempo máximo de conexão e de resposta por etapa; após falha, aplica-se a estimativa heurística local.</span>
            </label>
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6 space-y-3" aria-labelledby="config-seguranca">
            <h3 id="config-seguranca" className="text-lg font-semibold">Segurança</h3>
            <p className="text-sm text-gray-600">Aprovação obrigatória de novos usuários: <strong>sempre ativa</strong>. Controle de acesso ADMIN aplicado no backend.</p>
            <p className="text-sm text-gray-600">Segredos, duração do JWT e regras de senha são administrados no ambiente e no código; não podem ser alterados nesta tela.</p>
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6 space-y-3" aria-labelledby="config-sistema">
            <h3 id="config-sistema" className="text-lg font-semibold">Diagnóstico</h3>
            {diagnostico ? <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-gray-500">Versão do backend</dt><dd className="font-medium">{diagnostico.versaoSistema}</dd></div>
                <div><dt className="text-gray-500">Banco de dados</dt><dd className="font-medium">{diagnostico.bancoDados}</dd></div>
                <div><dt className="text-gray-500">FastAPI / modelo</dt><dd className="font-medium">{diagnostico.servicoIa}</dd></div>
                <div><dt className="text-gray-500">Versão do modelo</dt><dd className="font-medium">{diagnostico.versaoModelo}</dd></div>
                <div className="sm:col-span-2"><dt className="text-gray-500">Última alteração de configurações</dt><dd className="font-medium">{new Date(form.atualizadoEm).toLocaleString('pt-BR')}</dd></div>
            </dl> : <p className="text-sm text-gray-500">Diagnóstico indisponível.</p>}
            <button type="button" className="rounded-xl border border-gray-300 px-4 py-2 text-sm" onClick={() => void configuracoesService.diagnostico().then(({ data }) => setDiagnostico(data)).catch(() => setDiagnostico(null))}>Atualizar diagnóstico</button>
        </section>
        {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        {sucesso && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{sucesso}</p>}
        <div className="sticky bottom-0 z-10 grid grid-cols-1 gap-2 rounded-2xl border bg-white/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] shadow-sm backdrop-blur sm:flex sm:flex-wrap sm:gap-3 sm:p-4">
            <button type="submit" disabled={!modificado || salvando} className="min-h-11 rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar alterações'}</button>
            <button type="button" disabled={!modificado || salvando} onClick={() => { setForm(salvo); setErro(''); setSucesso(''); }} className="min-h-11 rounded-xl border px-5 py-3 disabled:opacity-50">Restaurar alterações não salvas</button>
            <button type="button" disabled={salvando} onClick={() => void carregar()} className="min-h-11 rounded-xl border px-5 py-3">Recarregar do servidor</button>
        </div>
    </form><GerenciamentoCargos /></div>;
}
