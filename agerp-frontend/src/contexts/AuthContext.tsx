/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

interface User {
    id: number;
    nome: string;
    email: string;
    perfilNome: string | null;
    ativo: boolean;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, senha: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    const isAuthenticated = !!user && user.ativo === true;

    const checkAuth = async (): Promise<void> => {
        try {
            const response = await authService.getCurrentUser();
            setUser(response.data);
        } catch {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, senha: string): Promise<void> => {
        await authService.login(email, senha);
        await checkAuth();
        navigate('/dashboard', { replace: true });
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