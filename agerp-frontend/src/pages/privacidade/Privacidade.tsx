import {Link} from 'react-router-dom';
import './PrivacidedaCSS.css';

const PoliticaDePrivacidade = () => {
    return (
        <div className="flex min-h-screen min-h-[100dvh] bg-gray-50 lg:h-screen lg:overflow-hidden">

            <div className="relative hidden h-full max-w-96 flex-col bg-slate-900 text-white lg:flex">
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
                        <div className="text-6xl mb-8">🔒</div>

                        <h2 className="text-3xl font-semibold leading-tight mb-4">
                            Política de Privacidade
                        </h2>
                        <p className="text-slate-300 text-lg">
                            Sua privacidade é nossa prioridade.
                            Conheça como o AGERP coleta, utiliza e protege seus dados pessoais em conformidade com a
                            LGPD.
                        </p>
                    </div>
                </div>

                <div className="p-8 border-t border-slate-800 mt-auto text-xs text-slate-400">
                    © 2026 AGERP • Todos os direitos reservados
                </div>

                <div className="absolute bottom-12 right-8 text-[160px] opacity-5 pointer-events-none">🛡️</div>
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
                                <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Política de Privacidade</h1>
                                <p className="text-sm text-gray-500 mt-3">
                                    Última atualização: 24 de março de 2026
                                </p>
                            </div>

                            <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed">
                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">1. Introdução</h2>
                                <p>O AGERP valoriza sua privacidade e está comprometido em proteger seus dados pessoais,
                                    em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº
                                    13.709/2018).</p>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">2. Dados que
                                    Coletamos</h2>
                                <p>Podemos coletar os seguintes dados:</p>
                                <ul className="list-disc pl-6 space-y-2 mt-4">
                                    <li><strong>Dados de Cadastro:</strong> nome, e-mail, telefone, nome da empresa;
                                    </li>
                                    <li><strong>Dados de Uso:</strong> logs de acesso, IP, ações realizadas no sistema;
                                    </li>
                                    <li><strong>Dados Financeiros:</strong> informações de pagamento (quando aplicável);
                                    </li>
                                    <li><strong>Dados de Negócio:</strong> clientes, produtos, pedidos, estoque
                                        inseridos por você.
                                    </li>
                                </ul>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">3. Finalidade do
                                    Tratamento</h2>
                                <p>Utilizamos seus dados para:</p>
                                <ul className="list-disc pl-6 space-y-2 mt-4">
                                    <li>Fornecer e melhorar nossos serviços;</li>
                                    <li>Autenticar e gerenciar sua conta;</li>
                                    <li>Cumprir obrigações legais e fiscais;</li>
                                    <li>Enviar comunicações importantes sobre o sistema.</li>
                                </ul>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">4. Compartilhamento de
                                    Dados</h2>
                                <p>Não vendemos seus dados. Podemos compartilhar apenas em casos necessários:</p>
                                <ul className="list-disc pl-6 space-y-2 mt-4">
                                    <li>Com prestadores de serviço (hospedagem, processamento de pagamento);</li>
                                    <li>Quando exigido por lei ou ordem judicial;</li>
                                    <li>Para proteger nossos direitos e segurança.</li>
                                </ul>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">5. Seus Direitos
                                    (LGPD)</h2>
                                <p>Você pode, a qualquer momento:</p>
                                <ul className="list-disc pl-6 space-y-2 mt-4">
                                    <li>Acessar seus dados;</li>
                                    <li>Corrigir dados incompletos ou incorretos;</li>
                                    <li>Solicitar exclusão de dados;</li>
                                    <li>Revogar consentimento;</li>
                                    <li>Solicitar portabilidade.</li>
                                </ul>
                                <p className="mt-6">Para exercer seus direitos, entre em contato pelo e-mail: <strong
                                    className="break-all text-indigo-600">privacidade@agerp.com.br</strong></p>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">6. Segurança dos
                                    Dados</h2>
                                <p>Adotamos medidas técnicas e administrativas para proteger seus dados contra acesso
                                    não autorizado, alteração, divulgação ou destruição.</p>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">7. Retenção de
                                    Dados</h2>
                                <p>Manteremos seus dados pelo tempo necessário para cumprir as finalidades descritas ou
                                    conforme exigido por lei.</p>

                                <h2 className="text-2xl font-semibold mt-12 mb-5 text-gray-900">8. Alterações nesta
                                    Política</h2>
                                <p>Podemos atualizar esta Política periodicamente. Recomendamos que você revise
                                    ocasionalmente.</p>
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

export default PoliticaDePrivacidade;
