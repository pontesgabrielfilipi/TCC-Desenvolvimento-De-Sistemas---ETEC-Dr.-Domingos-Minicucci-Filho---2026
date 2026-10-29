// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { useEffect, useState } from 'react';
import { configuracoesService } from '../services/configuracoesService';
import type { AparenciaSistema } from '../services/configuracoesService';

export function useAparenciaSistema() {
    const [aparencia, setAparencia] = useState<AparenciaSistema>({
        nomeEmpresa: 'AGERP', exibirAlertasEstoque: true,
    });

    useEffect(() => {
        let ativo = true;
        const atualizar = async () => {
            try {
                const { data } = await configuracoesService.aparencia();
                if (ativo) setAparencia(data);
            } catch {
                // A interface preserva os valores iniciais quando a API está indisponível.
            }
        };
        void atualizar();
        window.addEventListener('agerp:configuracoes-atualizadas', atualizar);
        return () => {
            ativo = false;
            window.removeEventListener('agerp:configuracoes-atualizadas', atualizar);
        };
    }, []);
    return aparencia;
}
