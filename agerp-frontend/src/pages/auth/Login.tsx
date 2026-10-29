// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { useState } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './LoginCSS.css';

const Login = () => {
    const { login } = useAuth();
    const location = useLocation();

    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);
    const [acessoNegado, setAcessoNegado] = useState<'PENDENTE' | 'BLOQUEADO' | 'REJEITADO' | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErro('');
        setAcessoNegado(null);
        setLoading(true);

        try {
            await login(email, senha);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const data = error.response?.data as { code?: string; codigo?: string; status?: string; statusAcesso?: string; message?: string } | undefined;
                const status = data?.statusAcesso || data?.status || data?.code || data?.codigo;
                if (status === 'PENDENTE' || status === 'USUARIO_PENDENTE') {
                    setAcessoNegado('PENDENTE');
                    return;
                }
                if (status === 'BLOQUEADO' || status === 'USUARIO_BLOQUEADO') {
                    setAcessoNegado('BLOQUEADO');
                    return;
                }
                if (status === 'REJEITADO' || status === 'USUARIO_REJEITADO') {
                    setAcessoNegado('REJEITADO');
                    return;
                }
                if (status === 'TEMPORARY_CREDENTIAL_INVALID' || status === 'CREDENCIAL_TEMPORARIA_EXPIRADA' || status === 'CREDENCIAL_TEMPORARIA_UTILIZADA') {
                    setErro(data?.message || 'A credencial temporária expirou ou já foi utilizada. Solicite uma nova redefinição ao administrador.');
                    return;
                }
            }
            setErro('Email ou senha inválidos. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen min-h-[100dvh] bg-gray-50 lg:h-screen lg:overflow-hidden">

            <div className="relative hidden h-full w-96 flex-col bg-slate-900 text-white lg:flex">
                <div className="p-8 border-b border-slate-800">
                    <Link to="/" className="brand text-4xl font-bold tracking-tight text-white no-underline">
                        AGERP
                    </Link>
                    <p className="text-xs text-slate-400 mt-1">Gestão Empresarial</p>
                </div>

                <div className="flex-1 p-8 flex flex-col justify-center">
                    <div className="max-w-xs">
                        <div className="text-6xl mb-8">🔐</div>

                        <h2 className="text-3xl font-semibold leading-tight mb-4">
                            Bem-vindo de volta ao AGERP
                        </h2>
                        <p className="text-slate-300 text-lg">
                            Acesse sua conta e gerencie clientes, produtos, pedidos e estoque com total controle.
                        </p>

                        <div className="mt-16 grid grid-cols-2 gap-6">
                            <div className="bg-slate-800/50 rounded-3xl p-5">
                                <div className="text-4xl font-semibold">+180</div>
                                <div className="text-xs text-slate-400 mt-1">negócios ativos</div>
                            </div>
                            <div className="bg-slate-800/50 rounded-3xl p-5">
                                <div className="text-4xl font-semibold">4.98</div>
                                <div className="text-xs text-slate-400 mt-1">avaliação média</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 border-t border-slate-800 mt-auto text-xs text-slate-400">
                    © 2026 AGERP • Todos os direitos reservados
                </div>

                <div className="absolute bottom-12 right-8 text-[160px] opacity-5 pointer-events-none">📊</div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">

                <header className="flex items-center justify-between gap-3 bg-slate-900 px-3 py-4 sm:px-6 lg:hidden">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="brand text-2xl font-bold tracking-tight text-white no-underline transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg sm:text-3xl">
                            AGERP
                        </Link>
                    </div>

                    <Link
                        to="/cadastro"
                        className="min-h-11 rounded-2xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-center text-sm font-medium text-slate-900 transition-all duration-300 ease-in-out hover:scale-105 hover:bg-gray-300 hover:shadow-lg sm:px-6"
                    >
                        Criar conta grátis
                    </Link>
                </header>

                <div className="min-w-0 flex-1 flex items-start lg:items-center justify-center p-3 sm:p-6 lg:p-10 overflow-y-auto overflow-x-hidden bgp">
                    <div className="w-full max-w-md my-4 sm:my-8">
                        <div className="rounded-3xl border border-gray-100 bg-white px-4 py-6 shadow sm:px-7 md:p-10">

                            <div className="text-center mb-8">
                                <div className="mx-auto w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                                    <span className="text-4xl">🔐</span>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Entrar na conta</h2>
                                <p className="mt-2 text-gray-600">Digite seus dados para continuar</p>
                            </div>

                            {location.state?.cadastroPendente && !acessoNegado && (
                                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-center text-sm font-medium">
                                    Cadastro realizado. Aguarde a aprovação do administrador para acessar o sistema.
                                </div>
                            )}

                            {new URLSearchParams(location.search).get('senhaAlterada') === '1' && (
                                <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-2xl text-center text-sm font-medium" role="status">
                                    Senha definitiva criada. Entre novamente com sua nova senha.
                                </div>
                            )}

                            {acessoNegado && (
                                <div className={`mb-6 p-5 rounded-2xl border ${acessoNegado === 'PENDENTE' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-red-50 border-red-200 text-red-800'}`} role="alert">
                                    <h3 className="font-semibold text-lg">
                                        {acessoNegado === 'PENDENTE' ? 'Acesso aguardando aprovação' : acessoNegado === 'BLOQUEADO' ? 'Conta bloqueada' : 'Cadastro rejeitado'}
                                    </h3>
                                    <p className="mt-2 text-sm">
                                        {acessoNegado === 'PENDENTE'
                                            ? 'Seu cadastro foi recebido, mas o acesso ao AGERP depende da autorização de um administrador.'
                                            : acessoNegado === 'BLOQUEADO'
                                                ? 'O acesso desta conta foi bloqueado por um administrador.'
                                                : 'Este cadastro não foi aprovado para acessar o AGERP.'}
                                    </p>
                                    <p className="mt-2 text-sm">Solicite a análise ao administrador responsável da sua organização pelos canais internos disponibilizados por ela.</p>
                                </div>
                            )}

                            {erro && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-center text-sm font-medium">
                                    {erro}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full rounded-2xl border border-gray-300 py-3.5 px-5 focus:border-indigo-500 focus:ring-0 transition-all"
                                        placeholder="admin@agerp.com"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={senha}
                                            onChange={(e) => setSenha(e.target.value)}
                                            className="w-full rounded-2xl border border-gray-300 py-3.5 px-5 focus:border-indigo-500 focus:ring-0 transition-all pr-12"
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                                            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                        >
                                            {showPassword ? '🙈' : '👁'}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                                >
                                    {loading ? (
                                        <>
                                            <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                                            <span>Entrando...</span>
                                        </>
                                    ) : (
                                        'Entrar'
                                    )}
                                </button>
                            </form>

                            <p className="mt-8 text-center text-sm text-gray-600">
                                Não tem uma conta?{' '}
                                <Link
                                    to="/cadastro"
                                    className="font-semibold hover:text-indigo-700 transition-colors"
                                >
                                    Criar conta grátis agora
                                </Link>
                            </p>

                            <p className="mt-4 text-center text-sm text-gray-600">
                                Ao continuar você concorda com os {""}
                                <Link to="/termos" className="hover:text-indigo-700 transition">Termos de Uso</Link> {" e "}
                                <Link to="/privacidade" className="hover:text-indigo-700 transition">Política de Privacidade</Link>
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
