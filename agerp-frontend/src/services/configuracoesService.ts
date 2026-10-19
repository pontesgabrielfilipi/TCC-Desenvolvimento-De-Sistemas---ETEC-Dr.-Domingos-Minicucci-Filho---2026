import api from '../api/axiosInstance';

export interface ConfiguracoesSistema {
    nomeEmpresa: string;
    limiteEstoqueBaixo: number;
    exibirAlertasEstoque: boolean;
    timeoutIaMs: number;
    versao: number;
    atualizadoEm: string;
}

export interface AparenciaSistema {
    nomeEmpresa: string;
    exibirAlertasEstoque: boolean;
}

export interface DiagnosticoSistema {
    versaoSistema: string;
    bancoDados: string;
    servicoIa: string;
    versaoModelo: string;
    ultimaConfiguracao: string;
}

export const configuracoesService = {
    consultar: () => api.get<ConfiguracoesSistema>('/api/admin/configuracoes'),
    atualizar: (payload: Omit<ConfiguracoesSistema, 'atualizadoEm'>) =>
        api.put<ConfiguracoesSistema>('/api/admin/configuracoes', payload),
    diagnostico: () => api.get<DiagnosticoSistema>('/api/admin/configuracoes/diagnostico'),
    aparencia: () => api.get<AparenciaSistema>('/api/configuracoes/aparencia'),
    notificarMudanca: () => window.dispatchEvent(new Event('agerp:configuracoes-atualizadas')),
};
