// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import axios from 'axios';

// A URL de build aceita apenas caminhos da mesma origem para não enviar cookies a hosts externos.
const apiBaseUrl = import.meta.env.VITE_API_URL || '/';
if (!/^\/(?!\/)[^\\]*$/.test(apiBaseUrl)) {
    throw new Error('VITE_API_URL deve ser um caminho absoluto relativo a mesma origem');
}

const api = axios.create({
    // Vite e Nginx encaminham este caminho; o navegador não acessa o localhost do cliente.
    baseURL: apiBaseUrl,
    withCredentials: true,        // Permite o envio do cookie HttpOnly de autenticação.
    timeout: 10000,
});

api.interceptors.request.use(
    async (config) => {
        if (!['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) {
            // A instância global evita recursão neste interceptor ao buscar o token CSRF.
            const result = await axios.get<{ token: string }>('/api/auth/csrf', { withCredentials: true });
            config.headers.set('X-XSRF-TOKEN', result.data.token);
        }
        if (config.url?.includes('/auth/login') ||
            config.url?.includes('/api/auth/login')) {
            return config;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            console.warn('Token inválido ou expirado. Redirecionando para login...');
        }
        return Promise.reject(error);
    }
);

export default api;
