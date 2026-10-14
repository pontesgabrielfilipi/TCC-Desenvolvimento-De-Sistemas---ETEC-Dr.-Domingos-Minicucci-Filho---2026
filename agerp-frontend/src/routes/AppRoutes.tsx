import { Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute } from './PrivateRoute';

// Páginas
import Login from '../pages/auth/Login';
import Cadastro from '../pages/cadastro/Cadastro';
import Dashboard from '../pages/dashboard/Dashboard';
import Clientes from '../pages/clientes/Clientes';
import Admin from '../pages/admin/Admin';
import SemPerfil from '../pages/sem-perfil/SemPerfil';
import Home from "../pages/index/Home.tsx";
import TermosDeUso from "../pages/termos/TermosDeUso.tsx";
import Privacidade from "../pages/privacidade/Privacidade.tsx";
import Produtos from "../pages/produtos/Produtos.tsx";
import Pedidos from "../pages/pedidos/Pedidos.tsx";

const AppRoutes = () => {
    return (
        <Routes>
            {/* Rotas Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/" element={<Home />} />
            <Route path="/termos" element={<TermosDeUso />} />
            <Route path="/privacidade" element={<Privacidade />}/>

            {/* Rotas Protegidas */}
            <Route element={<PrivateRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path={"/produtos"} element={<Produtos />} />
                <Route path={"/pedidos"} element={<Pedidos />} />
                <Route element={<PrivateRoute allowedProfiles={['ADMIN']} />}>
                    <Route path="/admin" element={<Admin />} />
                </Route>

                {/* Página para usuários sem perfil */}
                <Route path="/sem-perfil" element={<SemPerfil />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default AppRoutes;
