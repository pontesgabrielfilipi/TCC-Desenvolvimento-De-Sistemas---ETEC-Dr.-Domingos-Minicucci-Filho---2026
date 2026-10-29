<!--
Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.
-->

# Frontend do AGERP

Interface web do AGERP, desenvolvida com React 19, TypeScript 6 e Vite 8. As telas incluem autenticação, clientes, produtos, pedidos, dashboard e administração. O frontend consome a API Spring Boot; o banco de dados não é acessado diretamente pelo navegador.

## Desenvolvimento local

Na pasta `agerp-frontend/`, com Node.js e npm compatíveis com a versão do Vite indicada em [`package.json`](package.json):

```powershell
npm ci
npm run dev
```

É necessário configurar e iniciar o backend e suas dependências separadamente. Consulte o [README principal](../README.md) e a [configuração por ambiente](../docs/configuracao-ambientes.md). O servidor Vite usa por padrão a porta `5173`; o arquivo [`vite.config.ts`](vite.config.ts) permite ajustá-la com `AGERP_DEV_PORT` no `.env` da raiz, além de configurar o endereço de escuta, os hosts autorizados e o destino de `/api` (`AGERP_DEV_PROXY_TARGET`, padrão `http://127.0.0.1:8080`).

A autenticação depende dos cookies emitidos pelo backend e da proteção CSRF. As rotas protegidas verificam autenticação e permissões; a autorização efetiva permanece no servidor.

## Scripts disponíveis

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Executa o Vite para desenvolvimento. |
| `npm run build` | Compila o TypeScript e gera o bundle de produção. |
| `npm run lint` | Executa o ESLint. |
| `npm run preview` | Pré-visualiza o bundle compilado localmente. |
| `npm run test:e2e` | Executa os testes Playwright; alguns cenários exigem ambiente de teste configurado. |
| `npm run test:e2e:report` | Abre um relatório Playwright já gerado. |

## Organização

- `src/api/`: cliente HTTP e interceptadores.
- `src/components/`: componentes compartilhados e navegação.
- `src/contexts/`: estado de autenticação.
- `src/hooks/`: hooks reutilizáveis.
- `src/pages/`: páginas de autenticação, cadastros, dashboard e administração.
- `src/routes/`: definição e proteção das rotas.
- `src/services/`: chamadas à API por domínio.
- `src/utils/`: funções auxiliares e formatação.
- `tests/e2e/` e `tests/unit/`: testes de interface e de utilitários.

O build utilizado no Docker é servido pelo Nginx, cuja configuração está em [`nginx.conf`](nginx.conf). Para detalhes das telas, consulte a [documentação do frontend](../docs/frontend.md).

## Licença

O código próprio deste frontend está sujeito à [licença proprietária do projeto](../LICENSE). Bibliotecas e dependências mantêm suas licenças individuais.
