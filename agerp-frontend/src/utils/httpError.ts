// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import axios from 'axios';

interface ApiErrorBody {
    message?: string;
    error?: string;
}

export const getHttpErrorMessage = (error: unknown, fallback: string): string => {
    if (!axios.isAxiosError<ApiErrorBody | string>(error)) return fallback;

    const data = error.response?.data;
    if (typeof data === 'string' && data.trim()) return data;
    if (data && typeof data === 'object') return data.message || data.error || fallback;
    return error.message || fallback;
};

/** O Axios devolve até erros JSON como Blob quando responseType='blob'. */
export const getBlobHttpErrorMessage = async (error: unknown, fallback: string): Promise<string> => {
    if (error instanceof Error && !axios.isAxiosError(error)) return error.message || fallback;
    if (!axios.isAxiosError(error)) return fallback;
    const data: unknown = error.response?.data;
    if (!(data instanceof Blob)) return getHttpErrorMessage(error, fallback);

    try {
        const conteudo = (await data.slice(0, 64 * 1024).text()).trim();
        const json: unknown = JSON.parse(conteudo);
        if (json && typeof json === 'object') {
            const body = json as ApiErrorBody;
            if (typeof body.message === 'string' && body.message.trim()) return body.message;
            if (typeof body.error === 'string' && body.error.trim()) return body.error;
        }
    } catch {
        // HTML do proxy e stack traces não devem aparecer como mensagem para o usuário.
    }
    return fallback;
};
