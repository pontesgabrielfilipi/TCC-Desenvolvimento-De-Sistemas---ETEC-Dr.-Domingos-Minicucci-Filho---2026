import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import "./HomeCSS.css";

const Home = () => {
    const navigate = useNavigate();

    return (
        <div className="flex min-h-screen min-h-[100dvh] bg-gray-50 lg:h-screen lg:overflow-hidden">

            <div className="relative hidden h-full w-96 flex-col bg-slate-900 text-white lg:flex">
                <div className="p-8 border-b border-slate-800">
                    <Link to="/" className="brand text-3xl font-bold tracking-tight text-white no-underline">
                        AGERP
                    </Link>
                    <p className="text-xs text-slate-400 mt-1">Gestão Empresarial</p>
                </div>

                <div className="flex-1 p-8 flex flex-col justify-center">
                    <div className="max-w-xs">
                        <div className="text-5xl mb-6">📊</div>

                        <h2 className="text-2xl font-semibold leading-tight mb-4">
                            Gestão descomplicada
                        </h2>
                        <p className="text-slate-300 text-base">
                            Controle financeiro, vendas, estoque e clientes em um só lugar. Simples, rápido e feito para quem realmente usa no dia a dia.
                        </p>

                        <div className="mt-12 grid grid-cols-2 gap-5">
                            <div className="bg-slate-800/50 rounded-3xl p-4">
                                <div className="text-3xl font-semibold">+180</div>
                                <div className="text-xs text-slate-400 mt-1">negócios ativos</div>
                            </div>
                            <div className="bg-slate-800/50 rounded-3xl p-4">
                                <div className="text-3xl font-semibold">4.98</div>
                                <div className="text-xs text-slate-400 mt-1">avaliação média</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 border-t border-slate-800 mt-auto text-xs text-slate-400">
                    © 2026 AGERP • Todos os direitos reservados
                </div>

                <div className="absolute bottom-12 right-8 text-[140px] opacity-5 pointer-events-none">🚀</div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">

                <header className="flex flex-col items-stretch justify-between gap-3 bg-slate-900 px-3 py-4 min-[360px]:flex-row min-[360px]:items-center sm:px-6 lg:hidden">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            className="brand text-2xl font-bold tracking-tight text-white no-underline transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg sm:text-3xl"
                        >
                            AGERP
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 items-center gap-2 min-[360px]:flex min-[360px]:gap-3">
                        <button
                            onClick={() => navigate('/login')}
                            className="min-h-11 rounded-2xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium transition-all duration-300 ease-in-out hover:scale-105 hover:bg-gray-300 hover:shadow-lg sm:px-5"
                        >
                            Entrar
                        </button>
                        <button
                            onClick={() => navigate('/cadastro')}
                            className="min-h-11 rounded-2xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-all duration-300 ease-in-out hover:scale-105 hover:bg-indigo-700 hover:shadow-lg sm:px-5"
                        >
                            Conhecer o sistema
                        </button>
                    </div>
                </header>

                <div className="flex flex-1 flex-row-reverse items-center justify-center overflow-auto p-3 sm:p-6 md:p-10 bgph">
                    <div className={"position-absolute top-9 right-9 hidden lg:block transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-lg"}>
                        <Link to={"/login"} className={"transition-all ease-in-out duration-300 px-3 py-2.5 text-black rounded-3xl bg-white hover:bg-gray-50 border-2 border-gray-300 hover:border-gray-400 no-underline"}>Entre Já!</Link>
                    </div>
                    <div className="max-w-4xl w-full text-center bg-white p-4 rounded-5 border-2">
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl md:text-5xl lg:text-6xl">
                            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                                Gestão descomplicada
                            </span>
                            <br className="sm:hidden" />
                            &nbsp;para o seu negócio
                        </h1>

                        <p className="mt-5 text-lg md:text-xl leading-8 text-gray-600 max-w-2xl mx-auto">
                            Controle financeiro, vendas, estoque e clientes em um só lugar.<br className="hidden sm:inline" />
                            Simples, rápido e feito para quem realmente usa no dia a dia.
                        </p>

                        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button
                                onClick={() => navigate('/cadastro')}
                                className="w-full sm:w-auto transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg rounded-3xl bg-indigo-600 px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-indigo-500/30 hover:bg-indigo-700"
                            >
                                Começar agora →
                            </button>

                            <button
                                onClick={() => navigate('/sobre')}
                                className="w-full sm:w-auto transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg rounded-3xl border-2 border-gray-300 px-8 py-4 text-lg font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                            >
                                Ver funcionalidades
                            </button>
                        </div>

                        <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-center text-sm text-gray-500 sm:mt-14">
                            Já utilizado por{' '}
                            <strong className="text-gray-700 font-semibold">+180</strong>{' '}
                            pequenos e médios negócios no Brasil
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
