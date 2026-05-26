import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Cadastro = () => {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        tipo: 'FISICA' as 'FISICA' | 'JURIDICA',
        nome: '',
        email: '',
        telefone: '',
        cpfCnpj: '',
        empresa: '',
        senha: '',
        confirmarSenha: ''
    });

    const [loading, setLoading] = useState(false);

    // Toasts
    const [toasts, setToasts] = useState<{ id: number; type: 'success' | 'error'; message: string }[]>([]);

    const showToast = (type: 'success' | 'error', message: string) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    // Máscaras
    const formatarTelefone = (value: string) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .slice(0, 15);
    };

    const formatarCpfCnpj = (value: string) => {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length <= 11) {
            return cleaned
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        }
        return cleaned
            .replace(/(\d{2})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1/$2')
            .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'telefone') {
            setFormData(prev => ({ ...prev, telefone: formatarTelefone(value) }));
        } else if (name === 'cpfCnpj') {
            setFormData(prev => ({ ...prev, cpfCnpj: formatarCpfCnpj(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    // Validações
    const validarCPF = (cpf: string) => {
        const cleaned = cpf.replace(/\D/g, '');
        if (cleaned.length !== 11 || /^(\d)\1+$/.test(cleaned)) return false;
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
        let rest = (sum * 10) % 11;
        if (rest === 10 || rest === 11) rest = 0;
        if (rest !== parseInt(cleaned[9])) return false;
        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
        rest = (sum * 10) % 11;
        if (rest === 10 || rest === 11) rest = 0;
        return rest === parseInt(cleaned[10]);
    };

    const validarFormulario = () => {
        if (formData.senha !== formData.confirmarSenha) {
            showToast('error', 'As senhas não coincidem');
            return false;
        }
        if (formData.senha.length < 6) {
            showToast('error', 'A senha deve ter no mínimo 6 caracteres');
            return false;
        }
        if (formData.tipo === 'FISICA' && !validarCPF(formData.cpfCnpj)) {
            showToast('error', 'CPF inválido');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validarFormulario()) return;

        setLoading(true);

        try {
            const response = await fetch('http://localhost:8080/api/usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome: formData.nome,
                    email: formData.email,
                    senha: formData.senha,
                    idPerfil: 2,
                    ativo: true
                }),
            });

            if (response.ok) {
                showToast('success', 'Conta criada com sucesso!');
                setTimeout(() => navigate('/login'), 1800);
            } else {
                const data = await response.json();
                showToast('error', data.message || 'Erro ao criar conta');
            }
        } catch {
            showToast('error', 'Erro de conexão com o servidor');
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
                        <div className="text-6xl mb-8">✍️</div>

                        <h2 className="text-3xl font-semibold leading-tight mb-4">
                            Crie sua conta grátis
                        </h2>
                        <p className="text-slate-300 text-lg">
                            Comece agora mesmo. Sem cartão. Sem compromisso. 14 dias de teste completo.
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

                <div className="absolute bottom-12 right-8 text-[160px] opacity-5 pointer-events-none">🚀</div>
            </div>

            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 flex flex-col">

                {/* HEADER - SOMENTE TABLET E MOBILE */}
                <header className="lg:hidden bg-slate-900 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg brand text-3xl font-bold tracking-tight text-white no-underline"
                        >
                            AGERP
                        </Link>
                    </div>

                    <Link
                        to="/login"
                        className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg px-6 py-2.5 bg-gray-50 border border-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-300"
                    >
                        Já tem conta? Entrar
                    </Link>
                </header>

                {/* ÁREA DO FORMULÁRIO */}
                <div className="flex-1 flex items-start justify-center lg:pt-96 md:pt-96 pt-4 p-6 md:p-10 overflow-auto bgp">
                    <div className="w-full max-w-md">
                        <div className="md:pt-96 py-0">{""}</div>
                        <div className="bg-white rounded-3xl shadow px-7 py-5 pb-2 md:p-10 border border-gray-100">

                            {/* Cabeçalho do card */}
                            <div className="text-center mb-8">
                                <div className="mx-auto w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                                    <span className="text-4xl">✍️</span>
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900">Crie sua conta grátis</h2>
                                <p className="mt-2 text-gray-600">Comece a gerenciar seu negócio em minutos</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Tipo de Pessoa */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de Pessoa</label>
                                    <select
                                        name="tipo"
                                        value={formData.tipo}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-gray-300 py-3.5 px-5 focus:border-indigo-500 focus:ring-0 transition-all"
                                    >
                                        <option value="FISICA">Pessoa Física</option>
                                        <option value="JURIDICA">Pessoa Jurídica</option>
                                    </select>
                                </div>

                                {/* CPF / CNPJ */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        {formData.tipo === 'FISICA' ? 'CPF' : 'CNPJ'} *
                                    </label>
                                    <input
                                        type="text"
                                        name="cpfCnpj"
                                        value={formData.cpfCnpj}
                                        onChange={handleChange}
                                        maxLength={18}
                                        className="w-full rounded-2xl border border-gray-300 py-3.5 px-5 focus:border-indigo-500 focus:ring-0 transition-all"
                                        placeholder={formData.tipo === 'FISICA' ? '000.000.000-00' : '00.000.000/0000-00'}
                                        required
                                    />
                                </div>

                                {/* Nome / Razão Social */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo / Razão Social</label>
                                    <input
                                        type="text"
                                        name="nome"
                                        value={formData.nome}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-gray-300 py-3.5 px-5 focus:border-indigo-500 focus:ring-0 transition-all"
                                        placeholder="João Silva"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail profissional</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="w-full rounded-2xl border border-gray-300 py-3.5 px-5 focus:border-indigo-500 focus:ring-0 transition-all"
                                            placeholder="seuemail@empresa.com.br"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone / WhatsApp</label>
                                        <input
                                            type="tel"
                                            name="telefone"
                                            value={formData.telefone}
                                            onChange={handleChange}
                                            className="w-full rounded-2xl border border-gray-300 py-3.5 px-5 focus:border-indigo-500 focus:ring-0 transition-all"
                                            placeholder="(11) 98765-4321"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da empresa (opcional)</label>
                                    <input
                                        type="text"
                                        name="empresa"
                                        value={formData.empresa}
                                        onChange={handleChange}
                                        className="w-full rounded-2xl border border-gray-300 py-3.5 px-5 focus:border-indigo-500 focus:ring-0 transition-all"
                                        placeholder="Minha Loja Ltda"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
                                        <input
                                            type="password"
                                            name="senha"
                                            value={formData.senha}
                                            onChange={handleChange}
                                            className="w-full rounded-2xl border border-gray-300 py-3.5 px-5 focus:border-indigo-500 focus:ring-0 transition-all"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar senha</label>
                                        <input
                                            type="password"
                                            name="confirmarSenha"
                                            value={formData.confirmarSenha}
                                            onChange={handleChange}
                                            className="w-full rounded-2xl border border-gray-300 py-3.5 px-5 focus:border-indigo-500 focus:ring-0 transition-all"
                                            placeholder="••••••••"
                                            required
                                        />
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
                                            <span>Criando conta...</span>
                                        </>
                                    ) : (
                                        'Criar conta grátis →'
                                    )}
                                </button>
                            </form>

                            <p className="mt-8 text-center text-sm text-gray-600">
                                Já tem uma conta?{' '}
                                <Link
                                    to="/login"
                                    className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                                >
                                    Entrar agora
                                </Link>
                            </p>

                            <p className="mt-4 text-center text-sm text-gray-600">
                                Ao continuar você concorda com os{' '}
                                <Link to="/termos" className="hover:text-indigo-700 transition">Termos de Uso</Link>
                                {' e '}
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

            {/* TOASTS */}
            <div className="fixed bottom-6 right-6 space-y-2 z-[120]">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`px-6 py-4 rounded-2xl shadow-xl text-white flex items-center gap-3 min-w-[280px] ${
                            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                        }`}
                    >
                        {toast.type === 'success' ? '✅' : '❌'}
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Cadastro;