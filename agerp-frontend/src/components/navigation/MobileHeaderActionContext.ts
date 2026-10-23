import { createContext, useContext } from 'react';

// Contexto atravessa os Outlets intermediários de autorização, sem alterar suas regras.
export const MobileHeaderActionContext = createContext<HTMLDivElement | null>(null);

export const useMobileHeaderActionTarget = () => useContext(MobileHeaderActionContext);
