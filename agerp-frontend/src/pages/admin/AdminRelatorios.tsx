import { useEffect, useMemo, useRef, useState } from 'react';
import { clienteService } from '../../services/clienteService';
import { produtoService } from '../../services/produtoService';
import { usuarioService } from '../../services/usuarioService';
import { relatoriosService } from '../../services/relatoriosService';
import type { FiltroRelatorio, FiltrosRelatorio, RelatorioDisponivel } from '../../services/relatoriosService';
import { getHttpErrorMessage, getBlobHttpErrorMessage } from '../../utils/httpError';

type Opcao = { id: number; nome: string };

const statusPedidos = ['PENDENTE', 'CONFIRMADO', 'EM_PREPARACAO', 'PRONTO', 'ENTREGUE', 'CANCELADO', 'EM_ANDAMENTO'];
const ordemCategorias = ['Clientes', 'Produtos', 'Estoque', 'Pedidos', 'Vendas', 'Indicadores', 'Usuários', 'Auditoria', 'Logística'];

function filtrarParametros(filtros: FiltrosRelatorio, permitidos: FiltroRelatorio[]): FiltrosRelatorio {
    return Object.fromEntries(Object.entries(filtros).filter(([chave, valor]) =>
        permitidos.includes(chave as FiltroRelatorio) && valor !== '' && valor != null
    )) as FiltrosRelatorio;
}

function baixarArquivo(blob: Blob, nome: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function validarArquivoXlsx(blob: Blob): Promise<void> {
    if (blob.size < 22) throw new Error('O servidor retornou um arquivo XLSX vazio ou incompleto.');
    const inicio = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (inicio[0] !== 0x50 || inicio[1] !== 0x4b || inicio[2] !== 0x03 || inicio[3] !== 0x04) {
        throw new Error('O servidor não retornou uma planilha XLSX válida.');
    }
    // O registro final ZIP (EOCD) deve estar no fim do arquivo, incluindo um eventual comentário.
    const trecho = new Uint8Array(await blob.slice(-65557).arrayBuffer());
    let zipCompleto = false;
    for (let i = trecho.length - 22; i >= 0; i--) {
        if (trecho[i] === 0x50 && trecho[i + 1] === 0x4b && trecho[i + 2] === 0x05
                && trecho[i + 3] === 0x06 && i + 22 + trecho[i + 20] + 256 * trecho[i + 21] === trecho.length) {
            zipCompleto = true;
            break;
        }
    }
    if (!zipCompleto) throw new Error('O download foi interrompido antes da conclusão do XLSX. Tente novamente.');
}

export default function AdminRelatorios() {
    const [catalogo, setCatalogo] = useState<RelatorioDisponivel[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');
    const [erroExportacao, setErroExportacao] = useState('');
    const [sucesso, setSucesso] = useState('');
    const [baixando, setBaixando] = useState<string | null>(null);
    const [selecionado, setSelecionado] = useState<string | null>(null);
    const [categoria, setCategoria] = useState('Todos');
    const [busca, setBusca] = useState('');
    const [filtros, setFiltros] = useState<FiltrosRelatorio>({});
    const [clientes, setClientes] = useState<Opcao[]>([]);
    const [produtos, setProdutos] = useState<Opcao[]>([]);
    const [usuarios, setUsuarios] = useState<Opcao[]>([]);
    const [erroOpcoes, setErroOpcoes] = useState('');
    const exportacaoAtiva = useRef<AbortController | null>(null);

    useEffect(() => () => { exportacaoAtiva.current?.abort(); }, []);

    useEffect(() => {
        let ativo = true;
        async function carregar() {
            setCarregando(true);
            setErro('');
            try {
                const dados = await relatoriosService.catalogo();
                if (!ativo) return;
                setCatalogo(dados);
                setSelecionado(atual => atual && dados.some(item => item.id === atual) ? atual : (dados[0]?.id ?? null));
            } catch (error) {
                if (ativo) setErro(getHttpErrorMessage(error, 'Não foi possível carregar os relatórios.'));
            } finally {
                if (ativo) setCarregando(false);
            }
        }
        void carregar();
        return () => { ativo = false; };
    }, []);

    const relatorio = catalogo.find(item => item.id === selecionado);
    const categorias = useMemo(() => Array.from(new Set(catalogo.map(item => item.categoria)))
        .sort((a, b) => ordemCategorias.indexOf(a) - ordemCategorias.indexOf(b)), [catalogo]);
    const visiveis = useMemo(() => catalogo.filter(item =>
        (categoria === 'Todos' || item.categoria === categoria)
        && `${item.titulo} ${item.descricao} ${item.categoria}`.toLocaleLowerCase('pt-BR')
            .includes(busca.trim().toLocaleLowerCase('pt-BR'))
    ), [catalogo, categoria, busca]);

    useEffect(() => {
        let ativo = true;
        if (!relatorio) return;
        const necessita = new Set(relatorio.filtros);
        async function carregarOpcoes() {
            const requisicoes: Promise<void>[] = [];
            if (necessita.has('clienteId') && !clientes.length) {
                requisicoes.push(clienteService.listar().then(res => {
                    if (ativo) setClientes((Array.isArray(res.data) ? res.data : res.data?.content ?? [])
                        .map((item: { id: number; nomeRazao: string }) => ({ id: item.id, nome: item.nomeRazao })));
                }));
            }
            if (necessita.has('produtoId') && !produtos.length) {
                requisicoes.push(produtoService.listarTodos().then(res => {
                    if (ativo) setProdutos((Array.isArray(res.data) ? res.data : res.data?.content ?? [])
                        .map((item: { id: number; nome: string }) => ({ id: item.id, nome: item.nome })));
                }));
            }
            if (necessita.has('usuarioId') && !usuarios.length) {
                requisicoes.push(usuarioService.listarTodos().then(res => {
                    if (ativo) setUsuarios((Array.isArray(res.data) ? res.data : res.data?.content ?? [])
                        .map((item: { id: number; nome: string }) => ({ id: item.id, nome: item.nome })));
                }));
            }
            const resultados = await Promise.allSettled(requisicoes);
            if (ativo && resultados.some(resultado => resultado.status === 'rejected')) {
                setErroOpcoes('Algumas opções não puderam ser carregadas. Você ainda pode exportar sem esses filtros.');
            }
        }
        void carregarOpcoes();
        return () => { ativo = false; };
        // As listas ficam em cache no componente para evitar novas requisições ao trocar de relatório.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selecionado]);

    async function exportar() {
        if (!relatorio || baixando) return;
        if (filtros.inicio && filtros.fim && filtros.inicio > filtros.fim) {
            setErroExportacao('A data inicial não pode ser posterior à data final.');
            return;
        }
        setErroExportacao('');
        setSucesso('');
        setBaixando(relatorio.id);
        const controle = new AbortController();
        exportacaoAtiva.current = controle;
        try {
            const { arquivo, exportId } = await relatoriosService.exportar(relatorio.id, filtrarParametros(filtros, relatorio.filtros), controle.signal);
            if (controle.signal.aborted) return;
            await validarArquivoXlsx(arquivo);
            if (controle.signal.aborted) return;
            // O nome é derivado do catálogo autorizado pelo servidor (sem entradas livres).
            baixarArquivo(arquivo, `agerp_${relatorio.id}_${new Date().toISOString().slice(0, 10)}.xlsx`);
            setSucesso(`Arquivo XLSX recebido pelo navegador e download solicitado. O salvamento depende do navegador.${exportId ? ` Exportação: ${exportId}` : ''}`);
        } catch (error) {
            if (!controle.signal.aborted) {
                setErroExportacao(await getBlobHttpErrorMessage(error, 'Falha ao gerar XLSX. Verifique a conexão e tente novamente.'));
            }
        } finally {
            if (exportacaoAtiva.current === controle) {
                exportacaoAtiva.current = null;
                setBaixando(null);
            }
        }
    }

    function cancelarExportacao() {
        exportacaoAtiva.current?.abort();
        exportacaoAtiva.current = null;
        setBaixando(null);
        setSucesso('');
        setErroExportacao('Download cancelado neste navegador. A geração já iniciada no servidor pode concluir antes de detectar a desconexão.');
    }

    function atualizarFiltro(campo: keyof FiltrosRelatorio, valor: string) {
        setFiltros(atual => ({ ...atual, [campo]: campo.endsWith('Id') ? (valor ? Number(valor) : undefined) : valor || undefined }));
        setErroExportacao('');
        setSucesso('');
    }

    const classeInput = 'mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200';

    return (
        <section aria-labelledby="titulo-relatorios" className="min-w-0 space-y-5 pb-8">
            <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
                <h2 id="titulo-relatorios" className="text-2xl font-bold text-slate-900">Central de relatórios</h2>
                <p className="mt-2 text-sm text-slate-600">Exporte os dados do AGERP para Excel. Cada arquivo inclui informações sobre filtros, data de geração e totais aplicáveis; a exportação não depende da paginação das tabelas.</p>
            </div>

            {carregando && <div className="rounded-2xl bg-white p-8 text-center text-slate-600" role="status">Carregando catálogo de relatórios...</div>}
            {erro && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700" role="alert">{erro} <button className="underline" onClick={() => window.location.reload()}>Recarregar</button></div>}
            {!carregando && !erro && catalogo.length === 0 && <div className="rounded-2xl bg-white p-8 text-center text-slate-600">Nenhum relatório disponível.</div>}

            {!carregando && !erro && catalogo.length > 0 && (
                <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,400px)]">
                    <div className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
                        <label htmlFor="buscar-relatorio" className="block text-sm font-medium text-slate-800">Localizar relatório</label>
                        <input id="buscar-relatorio" type="search" value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar por nome ou descrição" className={classeInput} />
                        <div className="mt-4 flex max-w-full flex-wrap gap-2" aria-label="Categorias de relatórios">
                            {['Todos', ...categorias].map(item => <button key={item} type="button" onClick={() => setCategoria(item)} aria-pressed={categoria === item}
                                className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${categoria === item ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{item}</button>)}
                        </div>
                        <p className="mt-4 text-xs text-slate-500">{visiveis.length} relatório(s) encontrado(s)</p>
                        {!visiveis.length && <p className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-600">Nenhum relatório corresponde à busca.</p>}
                        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                            {visiveis.map(item => <button type="button" key={item.id} onClick={() => { setSelecionado(item.id); setErroExportacao(''); setSucesso(''); }}
                                aria-pressed={item.id === selecionado}
                                className={`min-w-0 rounded-xl border p-4 text-left transition-colors ${item.id === selecionado ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-300' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}>
                                <span className="block text-xs font-semibold uppercase tracking-wide text-indigo-700">{item.categoria}</span>
                                <span className="mt-1 block break-words font-semibold text-slate-900">{item.titulo}</span>
                                <span className="mt-2 block break-words text-xs leading-relaxed text-slate-600">{item.descricao}</span>
                            </button>)}
                        </div>
                    </div>

                    <div className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6 xl:sticky xl:top-5">
                        {relatorio && <>
                            <div className="border-b border-slate-200 pb-4">
                                <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{relatorio.categoria}</span>
                                <h3 className="mt-1 break-words text-xl font-bold text-slate-900">{relatorio.titulo}</h3>
                                <p className="mt-2 text-sm text-slate-600">{relatorio.descricao}</p>
                            </div>
                            <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
                                {relatorio.filtros.includes('inicio') && <label className="block text-sm font-medium text-slate-700">Data inicial<input type="date" value={filtros.inicio ?? ''} onChange={e => atualizarFiltro('inicio', e.target.value)} className={classeInput} /></label>}
                                {relatorio.filtros.includes('fim') && <label className="block text-sm font-medium text-slate-700">Data final<input type="date" value={filtros.fim ?? ''} min={filtros.inicio} onChange={e => atualizarFiltro('fim', e.target.value)} className={classeInput} /></label>}
                                {relatorio.filtros.includes('clienteId') && <label className="block text-sm font-medium text-slate-700">Cliente<select value={filtros.clienteId ?? ''} onChange={e => atualizarFiltro('clienteId', e.target.value)} className={classeInput}><option value="">Todos os clientes</option>{clientes.map(item => <option key={item.id} value={item.id}>{item.nome} (#{item.id})</option>)}</select></label>}
                                {relatorio.filtros.includes('produtoId') && <label className="block text-sm font-medium text-slate-700">Produto<select value={filtros.produtoId ?? ''} onChange={e => atualizarFiltro('produtoId', e.target.value)} className={classeInput}><option value="">Todos os produtos</option>{produtos.map(item => <option key={item.id} value={item.id}>{item.nome} (#{item.id})</option>)}</select></label>}
                                {relatorio.filtros.includes('usuarioId') && <label className="block text-sm font-medium text-slate-700">Usuário<select value={filtros.usuarioId ?? ''} onChange={e => atualizarFiltro('usuarioId', e.target.value)} className={classeInput}><option value="">Todos os usuários</option>{usuarios.map(item => <option key={item.id} value={item.id}>{item.nome} (#{item.id})</option>)}</select></label>}
                                {relatorio.filtros.includes('status') && <label className="block text-sm font-medium text-slate-700">Status do pedido<select value={filtros.status ?? ''} onChange={e => atualizarFiltro('status', e.target.value)} className={classeInput}><option value="">Todos os status</option>{statusPedidos.map(item => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>}
                            </div>
                            {relatorio.filtros.length === 0 && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Este relatório apresenta todos os dados registrados, sem filtros adicionais.</p>}
                            {relatorio.filtros.length > 0 && <button type="button" className="mt-4 text-sm font-medium text-indigo-700 underline" onClick={() => setFiltros({})}>Limpar filtros</button>}
                            {erroOpcoes && <p className="mt-3 text-sm text-amber-700" role="status">{erroOpcoes}</p>}
                            {erroExportacao && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{erroExportacao}</p>}
                            {sucesso && <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800" role="status">{sucesso}</p>}
                            <button type="button" disabled={baixando !== null} onClick={() => void exportar()}
                                className="mt-5 w-full rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60">
                                {baixando ? 'Gerando planilha XLSX...' : 'Exportar XLSX'}
                            </button>
                            {baixando && <button type="button" onClick={cancelarExportacao}
                                className="mt-2 w-full rounded-xl border border-red-300 bg-white px-5 py-2.5 font-semibold text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
                                Cancelar download
                            </button>}
                            <p className="mt-3 text-xs leading-relaxed text-slate-500">Arquivos muito grandes podem demorar; mantenha a página aberta até o download. O arquivo inclui uma aba com os filtros e, quando aplicável, uma aba de totais.</p>
                        </>}
                    </div>
                </div>
            )}
        </section>
    );
}
