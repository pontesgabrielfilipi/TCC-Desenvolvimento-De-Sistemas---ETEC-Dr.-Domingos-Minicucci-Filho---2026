// Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
// Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { AuthProvider } from './contexts/AuthContext';

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;