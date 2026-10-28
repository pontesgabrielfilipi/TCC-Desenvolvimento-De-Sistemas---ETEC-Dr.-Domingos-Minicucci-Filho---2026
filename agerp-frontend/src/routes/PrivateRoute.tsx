// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { navigationItems } from '../components/navigation/navigationItems';

interface PrivateRouteProps {
    allowedProfiles?: string[];
    requiredPage?: string;
}

export const PrivateRoute = ({ allowedProfiles, requiredPage }: PrivateRouteProps) => {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();
    const primeiraRota = navigationItems.find(item => user?.paginas?.includes(item.page)
        && (!item.profiles || item.profiles.includes(user?.perfilNome ?? '')))?.path ?? '/sem-acesso';

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (user?.trocaSenhaObrigatoria && location.pathname !== '/alterar-senha-obrigatoria') {
        return <Navigate to="/alterar-senha-obrigatoria" replace />;
    }

    if (!user?.trocaSenhaObrigatoria && location.pathname === '/alterar-senha-obrigatoria') {
        return <Navigate to={primeiraRota} replace />;
    }

    // Evita o redirecionamento circular da própria página /sem-perfil.
    if (!user?.perfilNome && location.pathname !== '/sem-perfil') {
        return <Navigate to="/sem-perfil" replace />;
    }

    if (user?.perfilNome && location.pathname === '/sem-perfil') {
        return <Navigate to={primeiraRota} replace />;
    }

    if (location.pathname === '/sem-acesso' && primeiraRota !== '/sem-acesso') {
        return <Navigate to={primeiraRota} replace />;
    }

    if ((allowedProfiles && (!user?.perfilNome || !allowedProfiles.includes(user.perfilNome)))
        || (requiredPage && !user?.paginas?.includes(requiredPage))) {
        return <Navigate to={primeiraRota} replace />;
    }

    return <Outlet />;
};
