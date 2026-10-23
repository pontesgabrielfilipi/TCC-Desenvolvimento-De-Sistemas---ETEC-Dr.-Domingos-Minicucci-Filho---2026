import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { PASSWORD_MIN_LENGTH, validatePassword } from '../../utils/passwordValidation';

const AlterarSenhaObrigatoria = () => {
    const { logout } = useAuth();
    const [senha, setSenha] = useState('');
    const [confirmacaoSenha, setConfirmacaoSenha] = useState('');
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const erroValidacao = validatePassword(senha, confirmacaoSenha);
        if (erroValidacao) {
            setErro(erroValidacao);
            return;
        }

        setErro('');
        setLoading(true);
        try {
            await authService.alterarSenhaObrigatoria(senha, confirmacaoSenha);
            window.location.replace('/login?senhaAlterada=1');
        } catch (error) {
            const mensagem = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
            setErro(mensagem || 'Não foi possível alterar a senha. Verifique os dados e tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-slate-900 p-3 sm:p-6">
            <section className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-8" aria-labelledby="titulo-troca-senha">
                <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-3xl mb-5" aria-hidden="true">🔐</div>
                <h1 id="titulo-troca-senha" className="text-2xl font-bold text-gray-900">Defina uma nova senha</h1>
                <p className="mt-3 text-gray-600">Você entrou com uma credencial temporária. Crie uma senha definitiva antes de acessar o AGERP.</p>
                {erro && <div className="mt-5 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm" role="alert">{erro}</div>}
                <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                    <div>
                        <label htmlFor="nova-senha" className="block text-sm font-medium text-gray-700 mb-1.5">Nova senha</label>
                        <input id="nova-senha" type={mostrarSenha ? 'text' : 'password'} value={senha} onChange={event => setSenha(event.target.value)} minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" required className="w-full rounded-2xl border border-gray-300 py-3.5 px-5 focus:border-indigo-500 focus:ring-0" />
                    </div>
                    <div>
                        <label htmlFor="confirmar-nova-senha" className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar nova senha</label>
                        <input id="confirmar-nova-senha" type={mostrarSenha ? 'text' : 'password'} value={confirmacaoSenha} onChange={event => setConfirmacaoSenha(event.target.value)} minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" required className="w-full rounded-2xl border border-gray-300 py-3.5 px-5 focus:border-indigo-500 focus:ring-0" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" checked={mostrarSenha} onChange={event => setMostrarSenha(event.target.checked)} /> Mostrar senhas
                    </label>
                    <p className="text-sm text-gray-500">Use no mínimo {PASSWORD_MIN_LENGTH} caracteres, conforme a regra de cadastro.</p>
                    <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-4 rounded-2xl font-semibold">{loading ? 'Alterando...' : 'Salvar senha definitiva'}</button>
                    <button type="button" onClick={() => void logout()} className="w-full py-2 text-sm text-gray-600 hover:text-gray-900">Sair da conta</button>
                </form>
            </section>
        </main>
    );
};

export default AlterarSenhaObrigatoria;
