import { useAuth } from '../../contexts/AuthContext';

const SemPerfil = () => {
    const { logout } = useAuth();

    return (
        <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-gray-50 p-3 sm:p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 text-center shadow-xl sm:p-10">
                <div className="mx-auto w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center text-4xl mb-6">
                    ⚠️
                </div>

                <h1 className="mb-4 text-2xl font-bold text-gray-900 sm:text-3xl">Acesso Restrito</h1>

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
