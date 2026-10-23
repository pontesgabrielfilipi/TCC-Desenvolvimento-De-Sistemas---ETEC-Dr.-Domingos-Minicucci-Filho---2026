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

Funcionalidades implementadas no frontend React:

| Página | Caminho | Status |
| --- | --- | --- |
| Home | `/` | ✅ Implementada |
| Login | `/login` | ✅ Implementada |
| Cadastro | `/cadastro` | ✅ Implementada |
| Dashboard | `/dashboard` | ✅ Implementada |
| Clientes | `/clientes` | ✅ Implementada |
| Produtos | `/produtos` | ✅ Implementada |
| **Pedidos** | **/pedidos** | ✅ **Implementada** |
| Admin | `/admin` | ✅ Implementada |
| Sem Perfil | `/sem-perfil` | ✅ Implementada |

## Módulo de Pedidos

O módulo de Pedidos é implementado em `pages/pedidos/Pedidos.tsx` e segue o padrão visual e arquitetural das demais páginas administrativas.

### Componentes e padrões utilizados:
- **Sidebar**: Preservado e reutilizado do padrão existente (sem alteração estrutural).
- **Formatação monetária segura**: Todas as exibições de valores usam `utils/formatters.ts` → `formatCurrency()`, prevenindo `Cannot read properties of null (reading 'toFixed')`.
- **Service centralizado**: `services/pedidoService.ts` centraliza todas as chamadas à API.
- **Toasts**: Sistema de notificações reutilizado dos padrões de `Clientes.tsx` e `Produtos.tsx`.
- **Modal de criação**: Permite adicionar múltiplos itens com subtotais calculados interativamente.
- **Modal de detalhes**: Exibe todos os itens, valores e integra o painel de IA para previsão de entrega.
- **Modal de cancelamento**: Confirmação com aviso de estorno de estoque quando aplicável.

### Tipos TypeScript:
Definidos e exportados em `services/pedidoService.ts`:
- `PedidoResponse`
- `ItemPedidoResponse`
- `PedidoCreateRequest`
- `PedidoUpdateRequest`
- `ItemPedidoRequest`
- `PrevisaoEntregaResponse`

### Integração com IA:
O botão "Consultar Previsão de Entrega (IA)" no modal de detalhes chama `GET /api/pedidos/{id}/previsao-entrega`, que internamente aciona o `IaPrevisaoService` Java e o microsserviço Python. A resposta exibe prazo central, intervalo mín/máx, nível de confiança, rota e versão do modelo.
