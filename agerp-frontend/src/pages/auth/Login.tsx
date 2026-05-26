import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './LoginCSS.css';

const Login = () => {
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErro('');
        setLoading(true);

        try {
            await login(email, senha);
            // AuthContext já redireciona para /dashboard em caso de sucesso
        } catch {
            setErro('Email ou senha inválidos. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen bg-gray-50 flex overflow-hidden">

            {/* SIDEBAR DE BRANDING - Desktop only */}
            <div className="hidden lg:flex w-96 bg-slate-900 text-white flex-col h-screen relative">
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

                        {/* Trust signals */}
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

            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 flex flex-col">

                {/* HEADER - SOMENTE TABLET E MOBILE */}
                <header className="lg:hidden bg-slate-900 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg brand text-3xl font-bold tracking-tight text-white no-underline">
                            AGERP
                        </Link>
                    </div>

                    <Link
                        to="/cadastro"
                        className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg px-6 py-2.5 bg-gray-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300"
                    >
                        Criar conta grátis
                    </Link>
                </header>

                {/* ÁREA DO FORMULÁRIO - com margin-top em mobile/tablet */}
                <div className="flex-1 flex items-start justify-center align-middle lg:pt-96 md:pt-96 pt-4 p-6 md:p-10 overflow-auto bgp">
                    <div className="w-full max-w-md mt-6 md:mt-8 lg:mt-0">
                        <div className="md:pt-96 py-0">{""}</div>
                        <div className="bg-white rounded-3xl shadow px-7 py-5 pb-2 md:p-10 border border-gray-100">

                            {/* Cabeçalho do card */}
                            <div className="text-center mb-8">
                                <div className="mx-auto w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                                    <span className="text-4xl">🔐</span>
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900">Entrar na conta</h2>
                                <p className="mt-2 text-gray-600">Digite seus dados para continuar</p>
                            </div>

                            {erro && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-center text-sm font-medium">
                                    {erro}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-8">
                                {/* E-mail */}
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

                                {/* Senha */}
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
                                            className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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

                        {/*/!* Trust bar *!/*/}
                        {/*<div className={"flex justify-center"}>*/}
                        {/*    <p className="mt-8 text-center text-xs text-white bg-slate-900 rounded-3xl p-3 w-fit">*/}
                        {/*        +180 negócios já confiam no AGERP*/}
                        {/*    </p>*/}
                        {/*</div>*/}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;