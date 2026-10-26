import axios from 'axios';

// Parametro de build: somente caminhos relativos da mesma origem sao permitidos.
// Credenciais/cookies jamais devem ser enviados para um host configuravel externo.
const apiBaseUrl = import.meta.env.VITE_API_URL || '/';
if (!/^\/(?!\/)[^\\]*$/.test(apiBaseUrl)) {
    throw new Error('VITE_API_URL deve ser um caminho absoluto relativo a mesma origem');
}

const api = axios.create({
    // A API passa pelo proxy da mesma origem (Vite em dev, Nginx no Docker).
    // Nunca aponte o navegador do cliente remoto para o localhost dele.
    baseURL: apiBaseUrl,
    withCredentials: true,        // Essencial para cookies HttpOnly
    timeout: 10000,
});

// Interceptor de Request - não envia token no login
api.interceptors.request.use(
    async (config) => {
        if (!['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) {
            // Raw axios avoids recursion through this interceptor.
            const result = await axios.get<{ token: string }>('/api/auth/csrf', { withCredentials: true });
            config.headers.set('X-XSRF-TOKEN', result.data.token);
        }
        // Não adiciona Authorization no login
        if (config.url?.includes('/auth/login') ||
            config.url?.includes('/api/auth/login')) {
            return config;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor de Response
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            console.warn('Token inválido ou expirado. Redirecionando para login...');
            // Limpa cookie antigo se necessário
            // document.cookie = "jwtToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            // window.location.replace('/login');
        }
        return Promise.reject(error);
    }
);

export default api;
