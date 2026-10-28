// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import api from '../api/axiosInstance';

export interface ConfiguracoesSistema {
    nomeEmpresa: string;
    limiteEstoqueBaixo: number;
    usarEstoqueMinimoGeral: boolean;
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
