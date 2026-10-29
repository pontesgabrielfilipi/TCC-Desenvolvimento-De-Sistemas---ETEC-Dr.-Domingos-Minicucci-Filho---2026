// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { Link } from 'react-router-dom';
import './TermosCSS.css';

const TermosDeUso = () => {
    return (
        <div className="flex min-h-screen min-h-[100dvh] bg-gray-50 lg:h-screen lg:overflow-hidden">

            <div className="relative hidden h-full w-96 flex-col bg-slate-900 text-white lg:flex">
                <div className="p-8 border-b border-slate-800 flex justify-between ">
                    <div>
                        <Link to="/" className="brand text-4xl font-bold tracking-tight text-white no-underline">
                            AGERP
                        </Link>
                        <p className="text-xs text-slate-400 mt-1">Gestão Empresarial</p>
                    </div>
                    <div className={"content-center"}>
                        <Link
                            to="/login"
                            className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg px-6 py-2.5 bg-gray-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-100"
                        >
                            Voltar
                        </Link>
                    </div>
                </div>

                <div className="flex-1 p-8 flex flex-col justify-center">
                    <div className="max-w-xs">
                        <div className="text-6xl mb-8">📜</div>

                        <h2 className="text-3xl font-semibold leading-tight mb-4">
                            Termos de Uso
                        </h2>
                        <p className="text-slate-300 text-lg">
                            Transparência e compromisso com você.
                            Leia com atenção as condições de utilização da plataforma.
                        </p>
                    </div>
                </div>

                <div className="p-8 border-t border-slate-800 mt-auto text-xs text-slate-400">
                    © 2026 AGERP • Todos os direitos reservados
                </div>

                <div className="absolute bottom-12 right-8 text-[160px] opacity-5 pointer-events-none">⚖️</div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">

                <header className="flex items-center justify-between gap-3 bg-slate-900 px-3 py-4 sm:px-6 lg:hidden">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            className="brand text-2xl font-bold tracking-tight text-white no-underline transition-all duration-300 ease-in-out hover:scale-105 sm:text-3xl"
                        >
                            AGERP
                        </Link>
                    </div>

                    <Link
                        to="/login"
                        className="min-h-11 rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm font-medium transition-all duration-300 ease-in-out hover:scale-105 hover:bg-gray-100 hover:shadow-lg sm:px-6"
                    >
                        Voltar
                    </Link>
                </header>

                <div className="min-w-0 flex-1 overflow-auto p-3 sm:p-6 md:p-10 bgp">
                    <div className="mx-auto min-w-0 max-w-4xl">
                        <div className="min-w-0 break-words rounded-3xl border border-gray-100 bg-white p-5 shadow sm:p-8 md:p-12">

                            <div className="mb-10">
                                <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Termos de Uso</h1>
                                <p className="text-sm text-gray-500 mt-3">
                                    Última atualização: 24 de março de 2026
                                </p>
                            </div>

                            <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed">
                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">1. Aceitação dos Termos</h2>
                                <p>Ao acessar ou utilizar o AGERP, você concorda com estes Termos de Uso. Se não concordar, não utilize o sistema.</p>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">2. Descrição do Serviço</h2>
                                <p>O AGERP é uma plataforma de gestão empresarial (ERP) que oferece ferramentas para controle de clientes, produtos, estoque, pedidos, financeiro e usuários.</p>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">3. Cadastro e Conta</h2>
                                <p>Para utilizar o sistema, é necessário criar uma conta com informações verdadeiras e atualizadas. Você é responsável por manter a confidencialidade da sua senha.</p>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">4. Uso Aceitável</h2>
                                <p>Você concorda em não:</p>
                                <ul className="list-disc pl-6 space-y-2 mt-4">
                                    <li>Utilizar o sistema para fins ilegais;</li>
                                    <li>Tentar obter acesso não autorizado a outras contas;</li>
                                    <li>Carregar vírus, malware ou código malicioso;</li>
                                    <li>Explorar vulnerabilidades do sistema.</li>
                                </ul>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">5. Limitação de Responsabilidade</h2>
                                <p>O AGERP é fornecido "no estado em que se encontra". Não nos responsabilizamos por danos indiretos, perda de lucro ou interrupções no seu negócio decorrentes do uso da plataforma.</p>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">6. Pagamentos e Planos</h2>
                                <p>Algumas funcionalidades podem estar disponíveis apenas em planos pagos. O cancelamento pode ser feito a qualquer momento, mas não haverá reembolso de valores já pagos.</p>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">7. Encerramento da Conta</h2>
                                <p>Reservamos o direito de suspender ou encerrar sua conta caso haja violação destes termos.</p>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">8. Alterações nos Termos</h2>
                                <p>Podemos atualizar estes Termos periodicamente. A continuação do uso após as alterações implica aceitação dos novos termos.</p>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">9. Lei Aplicável</h2>
                                <p>Estes Termos são regidos pelas leis da República Federativa do Brasil.</p>
                            </div>

                            <div className="mt-16 pt-8 border-t text-center text-sm text-gray-500">
                                © 2026 AGERP - Todos os direitos reservados
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TermosDeUso;
