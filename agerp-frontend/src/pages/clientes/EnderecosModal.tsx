import { useState, useEffect, useCallback } from 'react';
import { enderecoService, type Endereco } from '../../services/enderecoService';
import { getHttpErrorMessage } from '../../utils/httpError';

interface Cliente {
    id: number;
    nomeRazao: string;
    tipo?: string;
    cpfCnpj?: string;
}

interface EnderecosModalProps {
    isOpen: boolean;
    cliente: Cliente | null;
    onClose: () => void;
    showToast: (type: 'success' | 'error', message: string) => void;
}

interface EnderecoFormState {
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
    latitude: string;
    longitude: string;
}

const initialFormState: EnderecoFormState = {
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    latitude: '',
    longitude: ''
};

export const EnderecosModal = ({ isOpen, cliente, onClose, showToast }: EnderecosModalProps) => {
    const [enderecos, setEnderecos] = useState<Endereco[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [buscandoCep, setBuscandoCep] = useState(false);

    // Modo formulário: listagem vs formulário (novo/edição)
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editandoEnderecoId, setEditandoEnderecoId] = useState<number | null>(null);
    const [formData, setFormData] = useState<EnderecoFormState>(initialFormState);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Confirmação de exclusão
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

    const carregarEnderecos = useCallback(async () => {
        if (!cliente?.id) return;
        try {
            setLoading(true);
            const response = await enderecoService.listarPorCliente(cliente.id);
            setEnderecos(response.data || []);
        } catch (error: unknown) {
            console.error('Erro ao listar endereços:', error);
            showToast('error', getHttpErrorMessage(error, 'Erro ao carregar endereços do cliente.'));
        } finally {
            setLoading(false);
        }
    }, [cliente?.id, showToast]);

    useEffect(() => {
        if (isOpen && cliente?.id) {
            carregarEnderecos();
            setIsFormOpen(false);
            setEditandoEnderecoId(null);
            setFormData(initialFormState);
            setFormErrors({});
            setDeleteConfirmId(null);
        }
    }, [isOpen, cliente?.id, carregarEnderecos]);

    if (!isOpen || !cliente) return null;

    const formatarCep = (val: string) => {
        const cleaned = val.replace(/\D/g, '').slice(0, 8);
        if (cleaned.length > 5) {
            return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
        }
        return cleaned;
    };

    const handleBuscarCep = async () => {
        const rawCep = formData.cep.replace(/\D/g, '');
        if (rawCep.length !== 8) {
            showToast('error', 'Informe um CEP válido com 8 dígitos para consultar.');
            return;
        }

        try {
            setBuscandoCep(true);
            const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
            const data = await res.json();

            if (data.erro) {
                showToast('error', 'CEP não encontrado na base do ViaCEP.');
                return;
            }

            setFormData(prev => ({
                ...prev,
                logradouro: data.logradouro || prev.logradouro,
                bairro: data.bairro || prev.bairro,
                cidade: data.localidade || prev.cidade,
                estado: data.uf || prev.estado
            }));
            showToast('success', 'Endereço preenchido pelo CEP!');
        } catch {
            showToast('error', 'Não foi possível consultar o CEP.');
        } finally {
            setBuscandoCep(false);
        }
    };

    const abrirNovoEndereco = () => {
        setEditandoEnderecoId(null);
        setFormData(initialFormState);
        setFormErrors({});
        setIsFormOpen(true);
    };

    const abrirEditarEndereco = (end: Endereco) => {
        setEditandoEnderecoId(end.id || null);
        setFormData({
            logradouro: end.logradouro || '',
            numero: end.numero || '',
            bairro: end.bairro || '',
            cidade: end.cidade || '',
            estado: end.estado || '',
            cep: end.cep ? formatarCep(end.cep) : '',
            latitude: end.latitude !== undefined && end.latitude !== null ? String(end.latitude) : '',
            longitude: end.longitude !== undefined && end.longitude !== null ? String(end.longitude) : ''
        });
        setFormErrors({});
        setIsFormOpen(true);
    };

    const cancelarFormulario = () => {
        setIsFormOpen(false);
        setEditandoEnderecoId(null);
        setFormData(initialFormState);
        setFormErrors({});
    };

    const handleChangeInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'cep') {
            setFormData(prev => ({ ...prev, cep: formatarCep(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        if (formErrors[name]) {
            setFormErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validarFormulario = (): boolean => {
        const errors: Record<string, string> = {};

        if (!formData.logradouro.trim()) {
            errors.logradouro = 'Logradouro é obrigatório';
        }
        if (!formData.cidade.trim()) {
            errors.cidade = 'Cidade é obrigatória';
        }
        if (!formData.estado.trim()) {
            errors.estado = 'Estado (UF) é obrigatório';
        }
        if (formData.cep && formData.cep.replace(/\D/g, '').length !== 8) {
            errors.cep = 'CEP deve conter 8 dígitos';
        }
        if (formData.latitude && isNaN(Number(formData.latitude))) {
            errors.latitude = 'Latitude inválida';
        }
        if (formData.longitude && isNaN(Number(formData.longitude))) {
            errors.longitude = 'Longitude inválida';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const salvarEndereco = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validarFormulario()) {
            showToast('error', 'Por favor, corrija os erros no formulário.');
            return;
        }

        try {
            setSaving(true);
            const payload: Endereco = {
                logradouro: formData.logradouro.trim(),
                numero: formData.numero.trim() || undefined,
                bairro: formData.bairro.trim() || undefined,
                cidade: formData.cidade.trim(),
                estado: formData.estado.trim().toUpperCase(),
                cep: formData.cep.trim() || undefined,
                latitude: formData.latitude ? parseFloat(formData.latitude) : null,
                longitude: formData.longitude ? parseFloat(formData.longitude) : null
            };

            if (editandoEnderecoId) {
                await enderecoService.atualizar(cliente.id, editandoEnderecoId, payload);
                showToast('success', 'Endereço atualizado com sucesso!');
            } else {
                await enderecoService.criar(cliente.id, payload);
                showToast('success', 'Endereço cadastrado com sucesso!');
            }

            cancelarFormulario();
            carregarEnderecos();
        } catch (error: unknown) {
            console.error('Erro ao salvar endereço:', error);
            showToast('error', getHttpErrorMessage(error, 'Erro ao salvar endereço.'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirmId) return;
        try {
            await enderecoService.excluir(cliente.id, deleteConfirmId);
            showToast('success', 'Endereço excluído com sucesso!');
            setDeleteConfirmId(null);
            carregarEnderecos();
        } catch (error: unknown) {
            console.error('Erro ao excluir endereço:', error);
            showToast('error', getHttpErrorMessage(error, 'Erro ao excluir endereço.'));
        }
    };

    return (
        <div className="agerp-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="enderecos-modal-titulo">
            <div className="agerp-modal-panel flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                
                {/* Header Modal */}
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center text-xl font-bold">
                            📍
                        </div>
                        <div className="min-w-0">
                            <h2 id="enderecos-modal-titulo" className="break-words text-lg font-bold leading-tight text-gray-900 sm:text-xl">
                                Endereços de {cliente.nomeRazao}
                            </h2>
                            <p className="mt-1 break-all text-xs text-gray-500">
                                Cliente ID #{cliente.id} {cliente.cpfCnpj ? `• ${cliente.cpfCnpj}` : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-xl font-medium text-gray-400 transition hover:bg-gray-200 hover:text-gray-600"
                        aria-label="Fechar endereços do cliente"
                    >
                        ✕
                    </button>
                </div>

                {/* Corpo com Scroll */}
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                    {!isFormOpen ? (
                        <>
                            <div className="mb-4 flex flex-col items-stretch justify-between gap-3 min-[360px]:flex-row min-[360px]:items-center">
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-gray-800 text-base">Lista de Endereços</h3>
                                    <p className="text-xs text-gray-500">
                                        {enderecos.length === 0
                                            ? 'Nenhum endereço cadastrado para este cliente.'
                                            : `${enderecos.length} endereço(s) cadastrado(s)`}
                                    </p>
                                </div>
                                <button
                                    onClick={abrirNovoEndereco}
                                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:scale-105 hover:bg-indigo-700"
                                >
                                    <span>+</span> Novo Endereço
                                </button>
                            </div>

                            {loading ? (
                                <div className="text-center py-16 text-gray-500">
                                    <div className="animate-spin inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mb-2"></div>
                                    <p className="text-sm">Carregando endereços...</p>
                                </div>
                            ) : enderecos.length === 0 ? (
                                <div className="text-center py-12 px-4 border-2 border-dashed border-gray-200 rounded-2xl">
                                    <div className="text-4xl mb-2">🏠</div>
                                    <h4 className="text-base font-semibold text-gray-700">Nenhum endereço cadastrado</h4>
                                    <p className="text-sm text-gray-400 max-w-sm mx-auto mt-1 mb-5">
                                        Adicione locais de entrega ou filiais para este cliente clicando no botão abaixo.
                                    </p>
                                    <button
                                        onClick={abrirNovoEndereco}
                                        className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium px-5 py-2.5 rounded-xl text-sm transition"
                                    >
                                        + Cadastrar Primeiro Endereço
                                    </button>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {enderecos.map((end) => (
                                        <div
                                            key={end.id}
                                            className="p-4 border border-gray-200 rounded-2xl hover:border-indigo-300 hover:shadow-sm transition bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                        >
                                            <div className="space-y-1">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                    <span className="break-words text-sm font-semibold text-gray-900">
                                                        {end.logradouro || 'Sem logradouro'}
                                                        {end.numero ? `, ${end.numero}` : ' (S/N)'}
                                                    </span>
                                                    {end.cep && (
                                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-mono">
                                                            CEP: {end.cep}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    {[end.bairro, end.cidade, end.estado].filter(Boolean).join(' • ') || 'Localização não especificada'}
                                                </p>
                                                {(end.latitude != null || end.longitude != null) && (
                                                    <p className="text-[11px] text-gray-400 font-mono">
                                                        Lat: {end.latitude ?? '—'} | Long: {end.longitude ?? '—'}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:self-center">
                                                <button
                                                    onClick={() => abrirEditarEndereco(end)}
                                                    className="min-h-11 rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-800"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirmId(end.id || null)}
                                                    className="min-h-11 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 hover:text-red-800"
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        /* Formulário de Criação/Edição */
                        <form onSubmit={salvarEndereco} className="space-y-4">
                            <div className="flex flex-col items-start justify-between gap-2 border-b border-gray-100 pb-3 min-[360px]:flex-row min-[360px]:items-center">
                                <h3 className="font-semibold text-gray-800 text-base">
                                    {editandoEnderecoId ? '✏️ Editar Endereço' : '➕ Novo Endereço'}
                                </h3>
                                <button
                                    type="button"
                                    onClick={cancelarFormulario}
                                    className="min-h-11 rounded-xl px-3 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                                >
                                    Voltar à listagem
                                </button>
                            </div>

                            {/* CEP com Busca ViaCEP */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                    CEP
                                </label>
                                <div className="flex flex-col gap-2 min-[360px]:flex-row">
                                    <input
                                        type="text"
                                        name="cep"
                                        value={formData.cep}
                                        onChange={handleChangeInput}
                                        placeholder="00000-000"
                                        maxLength={9}
                                        className={`min-w-0 flex-1 rounded-xl border ${formErrors.cep ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-indigo-500'} py-2.5 px-3.5 text-sm focus:outline-none`}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleBuscarCep}
                                        disabled={buscandoCep}
                                        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                                    >
                                        {buscandoCep ? (
                                            <span className="animate-spin">🔄</span>
                                        ) : (
                                            '🔍 Buscar CEP'
                                        )}
                                    </button>
                                </div>
                                {formErrors.cep && (
                                    <p className="text-red-500 text-xs mt-1">{formErrors.cep}</p>
                                )}
                            </div>

                            {/* Logradouro e Número */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                <div className="sm:col-span-3">
                                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                        Logradouro *
                                    </label>
                                    <input
                                        type="text"
                                        name="logradouro"
                                        value={formData.logradouro}
                                        onChange={handleChangeInput}
                                        placeholder="Rua, Avenida, Praça..."
                                        maxLength={200}
                                        className={`w-full rounded-xl border ${formErrors.logradouro ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-indigo-500'} py-2.5 px-3.5 text-sm focus:outline-none`}
                                    />
                                    {formErrors.logradouro && (
                                        <p className="text-red-500 text-xs mt-1">{formErrors.logradouro}</p>
                                    )}
                                </div>
                                <div className="sm:col-span-1">
                                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                        Número
                                    </label>
                                    <input
                                        type="text"
                                        name="numero"
                                        value={formData.numero}
                                        onChange={handleChangeInput}
                                        placeholder="Ex: 123"
                                        maxLength={20}
                                        className="w-full rounded-xl border border-gray-300 py-2.5 px-3.5 text-sm focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Bairro, Cidade e UF */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                        Bairro
                                    </label>
                                    <input
                                        type="text"
                                        name="bairro"
                                        value={formData.bairro}
                                        onChange={handleChangeInput}
                                        placeholder="Ex: Centro"
                                        maxLength={100}
                                        className="w-full rounded-xl border border-gray-300 py-2.5 px-3.5 text-sm focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                        Cidade *
                                    </label>
                                    <input
                                        type="text"
                                        name="cidade"
                                        value={formData.cidade}
                                        onChange={handleChangeInput}
                                        placeholder="Ex: São Paulo"
                                        maxLength={100}
                                        className={`w-full rounded-xl border ${formErrors.cidade ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-indigo-500'} py-2.5 px-3.5 text-sm focus:outline-none`}
                                    />
                                    {formErrors.cidade && (
                                        <p className="text-red-500 text-xs mt-1">{formErrors.cidade}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                        Estado (UF) *
                                    </label>
                                    <input
                                        type="text"
                                        name="estado"
                                        value={formData.estado}
                                        onChange={handleChangeInput}
                                        placeholder="Ex: SP"
                                        maxLength={50}
                                        className={`w-full rounded-xl border ${formErrors.estado ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-indigo-500'} py-2.5 px-3.5 text-sm focus:outline-none uppercase`}
                                    />
                                    {formErrors.estado && (
                                        <p className="text-red-500 text-xs mt-1">{formErrors.estado}</p>
                                    )}
                                </div>
                            </div>

                            {/* Latitude e Longitude (opcional, para integrações de IA e Logística do AGERP) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Latitude (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        name="latitude"
                                        value={formData.latitude}
                                        onChange={handleChangeInput}
                                        placeholder="Ex: -23.550520"
                                        className={`w-full rounded-xl border ${formErrors.latitude ? 'border-red-400' : 'border-gray-200'} py-2 px-3 text-xs focus:outline-none focus:border-indigo-500 font-mono`}
                                    />
                                    {formErrors.latitude && (
                                        <p className="text-red-500 text-xs mt-1">{formErrors.latitude}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Longitude (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        name="longitude"
                                        value={formData.longitude}
                                        onChange={handleChangeInput}
                                        placeholder="Ex: -46.633308"
                                        className={`w-full rounded-xl border ${formErrors.longitude ? 'border-red-400' : 'border-gray-200'} py-2 px-3 text-xs focus:outline-none focus:border-indigo-500 font-mono`}
                                    />
                                    {formErrors.longitude && (
                                        <p className="text-red-500 text-xs mt-1">{formErrors.longitude}</p>
                                    )}
                                </div>
                            </div>

                            {/* Botões do Formulário */}
                            <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 min-[360px]:flex-row">
                                <button
                                    type="button"
                                    onClick={cancelarFormulario}
                                    className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-sm text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm shadow-sm transition disabled:opacity-50"
                                >
                                    {saving ? 'Salvando...' : editandoEnderecoId ? 'Salvar Alterações' : 'Cadastrar Endereço'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="flex justify-end border-t border-gray-100 bg-gray-50 px-4 py-3 sm:px-6 sm:py-4">
                    <button
                        onClick={onClose}
                        className="min-h-11 w-full rounded-xl bg-gray-200 px-5 py-2.5 text-sm font-medium text-gray-800 transition hover:bg-gray-300 sm:w-auto"
                    >
                        Fechar
                    </button>
                </div>
            </div>

            {/* Modal de Confirmação de Exclusão de Endereço */}
            {deleteConfirmId && (
                <div className="agerp-modal-overlay fixed inset-0 z-[130] flex items-center justify-center bg-black/80" role="dialog" aria-modal="true" aria-labelledby="excluir-endereco-titulo">
                    <div className="agerp-modal-panel w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
                            ⚠️
                        </div>
                        <h3 id="excluir-endereco-titulo" className="text-center text-lg font-bold text-gray-900">Excluir Endereço?</h3>
                        <p className="text-gray-500 text-sm text-center mt-2 mb-6">
                            Esta ação removerá permanentemente o endereço selecionado deste cliente.
                        </p>
                        <div className="flex flex-col gap-3 min-[360px]:flex-row">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition"
                            >
                                Confirmar Exclusão
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
