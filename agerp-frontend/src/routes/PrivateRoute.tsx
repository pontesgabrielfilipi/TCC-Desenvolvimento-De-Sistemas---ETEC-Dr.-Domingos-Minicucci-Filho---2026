import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PrivateRouteProps {
    allowedProfiles?: string[];
}

export const PrivateRoute = ({ allowedProfiles }: PrivateRouteProps) => {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();

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
        return <Navigate to="/dashboard" replace />;
    }

    // Evita o redirecionamento circular da própria página /sem-perfil.
    if (!user?.perfilNome && location.pathname !== '/sem-perfil') {
        return <Navigate to="/sem-perfil" replace />;
    }

    if (user?.perfilNome && location.pathname === '/sem-perfil') {
        return <Navigate to="/dashboard" replace />;
    }

    if (allowedProfiles && (!user?.perfilNome || !allowedProfiles.includes(user.perfilNome))) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
};
