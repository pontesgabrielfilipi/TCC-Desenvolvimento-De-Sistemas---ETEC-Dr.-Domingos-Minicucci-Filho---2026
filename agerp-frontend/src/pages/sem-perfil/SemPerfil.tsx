import { useAuth } from '../../contexts/AuthContext';

const SemPerfil = () => {
    const { logout } = useAuth();

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center">
                <div className="mx-auto w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center text-4xl mb-6">
                    ⚠️
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-4">Acesso Restrito</h1>

                <p className="text-gray-600 text-lg leading-relaxed mb-8">
                    Seu usuário ainda não possui um <strong>cargo/perfil</strong> definido no sistema.
                </p>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8 text-left">
                    <p className="text-amber-800 font-medium">O que fazer agora?</p>
                    <p className="text-amber-700 text-sm mt-2">
                        Por favor, entre em contato com o <strong>administrador da empresa</strong> ou com o <strong>TI</strong>
                        para que seja atribuído um perfil ao seu usuário.
                    </p>
                </div>

                <button
                    onClick={logout}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-semibold transition flex items-center justify-center gap-2"
                >
                    Sair da conta
                </button>

                <p className="text-xs text-gray-400 mt-8">
                    Você será redirecionado para a tela de login após sair.
                </p>
            </div>
        </div>
    );
};

export default SemPerfil;