// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

export const PASSWORD_MIN_LENGTH = 6;

export const validatePassword = (senha: string, confirmarSenha: string): string | null => {
    if (senha !== confirmarSenha) {
        return 'As senhas não coincidem';
    }

    if (senha.length < PASSWORD_MIN_LENGTH) {
        return `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres`;
    }

    return null;
};
