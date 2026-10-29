// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { usuarioService, type PerfilResponse, type PerfilSaveRequest } from '../../services/usuarioService';
import { getHttpErrorMessage } from '../../utils/httpError';

const PAGINAS = [
    { codigo: 'DASHBOARD', titulo: 'Dashboard' },
    { codigo: 'CLIENTES', titulo: 'Clientes' },
    { codigo: 'PRODUTOS', titulo: 'Produtos' },
    { codigo: 'PEDIDOS', titulo: 'Pedidos' },
];
const modeloNovo: PerfilSaveRequest = { nome: '', descricao: '', nivelAutoridade: 20, paginas: ['DASHBOARD'] };

export default function GerenciamentoCargos() {
    const [cargos, setCargos] = useState<PerfilResponse[]>([]);
    const [selecionado, setSelecionado] = useState<number | null>(null);
    const [form, setForm] = useState<PerfilSaveRequest>({ ...modeloNovo });
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');
    const [sucesso, setSucesso] = useState('');
    const atual = cargos.find(c => c.id === selecionado);
    const imutavel = atual?.nome === 'ADMIN';

    const preencher = useCallback((cargo: PerfilResponse) => {
        setSelecionado(cargo.id);
        setForm({ nome: cargo.nome, descricao: cargo.descricao ?? '',
            nivelAutoridade: cargo.nivelAutoridade, paginas: [...cargo.paginas], versao: cargo.versao });
        setErro('');
        setSucesso('');
    }, []);

    const carregar = useCallback(async (destino?: number) => {
        setCarregando(true);
        try {
            const { data } = await usuarioService.listarPerfis();
            const lista = [...data].sort((a, b) => b.nivelAutoridade - a.nivelAutoridade || a.nome.localeCompare(b.nome));
            setCargos(lista);
            const proximo = lista.find(c => c.id === destino);
            if (proximo) preencher(proximo);
            setErro('');
        } catch (e) {
            setErro(getHttpErrorMessage(e, 'Não foi possível consultar os cargos.'));
        } finally {
            setCarregando(false);
        }
    }, [preencher]);

    useEffect(() => { void carregar(); }, [carregar]);

    const salvar = async (event: FormEvent) => {
        event.preventDefault();
        if (salvando || imutavel) return;
        setErro('');
        setSucesso('');
        setSalvando(true);
        try {
            const dados = { ...form, nome: form.nome.trim().toUpperCase(), descricao: form.descricao.trim() };
            const { data } = selecionado === null
                ? await usuarioService.criarCargo(dados)
                : await usuarioService.editarCargo(selecionado, dados);
            await carregar(data.id);
            setSucesso('Cargo salvo. As permissões serão aplicadas na próxima requisição de cada usuário.');
        } catch (e) {
            setErro(getHttpErrorMessage(e, 'Não foi possível salvar o cargo. Recarregue os dados e tente novamente.'));
        } finally {
            setSalvando(false);
        }
    };

    const excluir = async () => {
        if (!atual || atual.protegido || salvando || !window.confirm(`Excluir o cargo ${atual.nome}? Ele não pode estar atribuído a usuários.`)) return;
        setSalvando(true);
        setErro('');
        setSucesso('');
        try {
            await usuarioService.excluirCargo(atual.id);
            setSelecionado(null);
            setForm({ ...modeloNovo });
            await carregar();
            setSucesso('Cargo excluído.');
        } catch (e) {
            setErro(getHttpErrorMessage(e, 'Não foi possível excluir. Reatribua os usuários vinculados a este cargo.'));
        } finally {
            setSalvando(false);
        }
    };

    return <section aria-labelledby="cargos-titulo" className="max-w-5xl min-w-0 space-y-5 pb-10">
        <div>
            <h2 id="cargos-titulo" className="text-xl font-semibold text-gray-900">Gerenciamento de cargos</h2>
            <p className="mt-1 text-sm text-gray-600">Nível (1–99) indica hierarquia, mas não libera páginas sozinho. Somente o ADMIN (nível 100) administra usuários, cargos e configurações.</p>
        </div>
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
            <aside className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">Cargos existentes</h3>
                    <button type="button" onClick={() => { setSelecionado(null); setForm({ ...modeloNovo }); setErro(''); setSucesso(''); }} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white">+ Novo cargo</button>
                </div>
                {carregando && <p role="status" className="mt-4 text-sm text-gray-500">Carregando...</p>}
                <div className="mt-3 space-y-2">
                    {cargos.map(cargo => <button key={cargo.id} type="button" onClick={() => preencher(cargo)}
                        aria-pressed={selecionado === cargo.id}
                        className={`w-full min-w-0 rounded-xl border p-3 text-left transition-colors ${selecionado === cargo.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <span className="flex flex-wrap items-center gap-2 font-medium break-all">{cargo.nome} {cargo.protegido && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Padrão</span>}</span>
                        <span className="mt-1 block text-xs text-gray-600">Nível {cargo.nivelAutoridade} · {cargo.paginas.length} páginas</span>
                    </button>)}
                </div>
                <button type="button" onClick={() => void carregar(selecionado ?? undefined)} className="mt-4 rounded-xl border px-3 py-2 text-sm">Atualizar lista</button>
            </aside>
            <form onSubmit={e => void salvar(e)} className="min-w-0 space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
                <div><h3 className="text-lg font-semibold">{atual ? `Editar ${atual.nome}` : 'Criar cargo'}</h3>
                    {imutavel && <p className="mt-1 text-sm text-amber-700">O cargo ADMIN é reservado e não pode ser modificado.</p>}</div>
                <label className="block text-sm font-medium">Nome do cargo
                    <input required maxLength={100} disabled={imutavel || atual?.nome === 'OPERADOR' || salvando}
                        value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                        className="mt-1 w-full min-w-0 rounded-xl border p-3 disabled:bg-gray-100" />
                </label>
                <label className="block text-sm font-medium">Descrição
                    <textarea maxLength={500} rows={2} disabled={imutavel || salvando} value={form.descricao}
                        onChange={e => setForm({ ...form, descricao: e.target.value })}
                        className="mt-1 w-full min-w-0 rounded-xl border p-3 disabled:bg-gray-100" />
                </label>
                <label className="block text-sm font-medium">Nível de autoridade (1 a 99)
                    <input type="number" min="1" max={imutavel ? 100 : 99} required disabled={imutavel || salvando}
                        value={form.nivelAutoridade} onChange={e => setForm({ ...form, nivelAutoridade: Number(e.target.value) })}
                        className="mt-1 w-full min-w-0 rounded-xl border p-3 disabled:bg-gray-100" />
                </label>
                <fieldset disabled={imutavel || salvando} className="space-y-2">
                    <legend className="mb-2 text-sm font-semibold">Páginas permitidas</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {PAGINAS.map(pagina => <label key={pagina.codigo} className="flex min-w-0 items-center gap-3 rounded-xl border p-3 text-sm">
                            <input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={form.paginas.includes(pagina.codigo)}
                                onChange={e => setForm({ ...form, paginas: e.target.checked
                                    ? [...form.paginas, pagina.codigo]
                                    : form.paginas.filter(p => p !== pagina.codigo) })} />
                            {pagina.titulo}
                        </label>)}
                    </div>
                </fieldset>
                <p className="text-xs text-gray-600">A área Administração é exclusiva do ADMIN. Remoção de permissões afeta sessões já abertas na próxima requisição.</p>
                {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
                {sucesso && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{sucesso}</p>}
                <div className="flex flex-wrap gap-2">
                    {!imutavel && <button disabled={salvando || carregando} type="submit" className="min-h-11 rounded-xl bg-indigo-600 px-5 py-2 font-medium text-white disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar cargo'}</button>}
                    {atual && !atual.protegido && <button type="button" disabled={salvando} onClick={() => void excluir()} className="min-h-11 rounded-xl border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50">Excluir cargo</button>}
                </div>
            </form>
        </div>
    </section>;
}
