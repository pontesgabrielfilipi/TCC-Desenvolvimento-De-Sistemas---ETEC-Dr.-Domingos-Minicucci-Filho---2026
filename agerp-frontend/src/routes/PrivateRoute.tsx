import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const PrivateRoute = () => {
    const { isAuthenticated, isLoading, user } = useAuth();

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
    }

    // Se está autenticado mas NÃO tem perfil/cargo → redireciona para página especial
    if (isAuthenticated && (!user?.perfilNome || user.perfilNome === null)) {
        return <Navigate to="/sem-perfil" replace />;
    }

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};