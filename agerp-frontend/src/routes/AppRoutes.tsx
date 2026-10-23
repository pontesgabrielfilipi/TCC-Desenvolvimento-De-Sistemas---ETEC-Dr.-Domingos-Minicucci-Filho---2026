import { Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute } from './PrivateRoute';
import { AuthenticatedLayout } from '../components/navigation/AuthenticatedLayout';

// Páginas
import Login from '../pages/auth/Login';
import AlterarSenhaObrigatoria from '../pages/auth/AlterarSenhaObrigatoria';
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
                <Route path="/alterar-senha-obrigatoria" element={<AlterarSenhaObrigatoria />} />
                <Route element={<AuthenticatedLayout />}>
                <Route element={<PrivateRoute requiredPage="DASHBOARD" />}><Route path="/dashboard" element={<Dashboard />} /></Route>
                <Route element={<PrivateRoute requiredPage="CLIENTES" />}><Route path="/clientes" element={<Clientes />} /></Route>
                <Route element={<PrivateRoute requiredPage="PRODUTOS" />}><Route path="/produtos" element={<Produtos />} /></Route>
                <Route element={<PrivateRoute requiredPage="PEDIDOS" />}><Route path="/pedidos" element={<Pedidos />} /></Route>
                <Route element={<PrivateRoute allowedProfiles={['ADMIN']} requiredPage="ADMIN" />}>
                    <Route path="/admin" element={<Admin />} />
                </Route>
                </Route>

                {/* Página para usuários sem perfil */}
                <Route path="/sem-perfil" element={<SemPerfil />} />
                <Route path="/sem-acesso" element={<div className="min-h-screen grid place-items-center bg-slate-50 p-4"><div className="max-w-md rounded-2xl bg-white p-8 text-center shadow"><h1 className="text-2xl font-semibold">Sem páginas autorizadas</h1><p className="my-4 text-slate-600">Peça ao administrador para habilitar as páginas do seu cargo.</p><a className="text-indigo-700 underline" href="/login">Voltar ao login</a></div></div>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default AppRoutes;
