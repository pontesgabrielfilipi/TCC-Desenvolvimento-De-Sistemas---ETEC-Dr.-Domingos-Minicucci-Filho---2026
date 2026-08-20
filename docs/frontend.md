# Frontend

## Diretório

O frontend atual do repositório está em:

```text
agerp-frontend/
```

## Tecnologias verificadas

De acordo com o `package.json` atual:

- React 19.2.x
- React DOM 19.2.x
- TypeScript 6
- Vite 8
- Axios
- React Router DOM 7
- Tailwind CSS 3
- Recharts
- Bootstrap
- Headless UI
- Heroicons
- Lucide React
- React Icons
- XLSX

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Organização esperada

```text
agerp-frontend/
├── public/
├── src/
│   ├── api/
│   ├── assets/
│   ├── components/
│   ├── contexts/
│   ├── hooks/
│   ├── pages/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── vite.config.*
```

## Responsabilidades

### `api/`
Configuração de comunicação HTTP, principalmente Axios e interceptação/configuração de requisições.

### `components/`
Componentes reutilizáveis.

### `contexts/`
Contextos globais, especialmente autenticação e estado compartilhado.

### `pages/`
Telas completas da aplicação.

### `routes/`
Configuração das rotas e proteção de páginas.

### `services/`
Serviços responsáveis por organizar chamadas e operações específicas da API.

### `utils/`
Funções auxiliares.

## Integração

O frontend consome a API Spring Boot. Como a autenticação utiliza cookie HttpOnly, o cliente HTTP deve ser configurado corretamente para permitir o envio de credenciais quando necessário.

## Estado atual

O README do projeto registra autenticação, gestão de usuários/perfis e dashboard como funcionalidades implementadas, enquanto o CRUD de clientes no React e alguns gráficos aparecem como etapas de desenvolvimento.
