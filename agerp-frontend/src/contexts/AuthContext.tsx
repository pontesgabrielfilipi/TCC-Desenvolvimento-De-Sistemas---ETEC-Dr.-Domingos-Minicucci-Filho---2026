/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { navigationItems } from '../components/navigation/navigationItems';

interface User {
    id: number;
    nome: string;
    email: string;
    perfilNome: string | null;
    ativo: boolean;
    statusAcesso?: 'PENDENTE' | 'APROVADO' | 'BLOQUEADO' | 'REJEITADO';
    trocaSenhaObrigatoria?: boolean;
    paginas?: string[];
    nivelAutoridade?: number;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, senha: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    const isAuthenticated = !!user && user.ativo === true &&
        (!user.statusAcesso || user.statusAcesso === 'APROVADO');

    const checkAuth = async (): Promise<User | null> => {
        try {
            const response = await authService.getCurrentUser();
            setUser(response.data);
            return response.data;
        } catch {
            setUser(null);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, senha: string): Promise<void> => {
        const response = await authService.login(email, senha);
        const usuarioAtual = await checkAuth();
        const exigeTroca = response.data?.trocaSenhaObrigatoria === true || usuarioAtual?.trocaSenhaObrigatoria === true;
        const primeiraRota = navigationItems.find(item => usuarioAtual?.paginas?.includes(item.page)
            && (!item.profiles || item.profiles.includes(usuarioAtual?.perfilNome ?? '')))?.path ?? '/sem-acesso';
        navigate(exigeTroca ? '/alterar-senha-obrigatoria' : primeiraRota, { replace: true });
    };

    const logout = async (): Promise<void> => {
        try {
            await authService.logout();
        } catch {
            // Ignora erro no logout
        } finally {
            setUser(null);
            navigate('/login', { replace: true });
        }
    };

    useEffect(() => {
        checkAuth();
        const recarregar = () => { if (document.visibilityState === 'visible') void checkAuth(); };
        window.addEventListener('focus', recarregar);
        document.addEventListener('visibilitychange', recarregar);
        const intervalo = window.setInterval(recarregar, 60000);
        return () => {
            window.removeEventListener('focus', recarregar);
            document.removeEventListener('visibilitychange', recarregar);
            window.clearInterval(intervalo);
        };
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated,
                isLoading,
                login,
                logout,
                checkAuth,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
};
