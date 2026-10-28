// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { createContext, useContext } from 'react';

// Contexto atravessa os Outlets intermediários de autorização, sem alterar suas regras.
export const MobileHeaderActionContext = createContext<HTMLDivElement | null>(null);

export const useMobileHeaderActionTarget = () => useContext(MobileHeaderActionContext);
