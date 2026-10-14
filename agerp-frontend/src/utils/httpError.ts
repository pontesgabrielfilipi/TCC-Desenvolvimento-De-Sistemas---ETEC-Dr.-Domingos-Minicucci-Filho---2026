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
