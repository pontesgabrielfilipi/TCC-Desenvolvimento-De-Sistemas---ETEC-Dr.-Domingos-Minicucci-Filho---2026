# Autenticação e Segurança

## Estratégia

O AGERP utiliza Spring Security com autenticação baseada em JWT.

O JWT é armazenado em **HttpOnly Cookie**, evitando que o token seja acessível diretamente por JavaScript no navegador.

## Fluxo

```text
Usuário
  │
  │ email + senha
  ▼
POST /api/auth/login
  │
  ▼
Spring Security
  │
  ├── valida credenciais
  ├── carrega usuário
  └── verifica perfil
  │
  ▼
JWT
  │
  ▼
HttpOnly Cookie
  │
  ▼
Requisições autenticadas
```

## Componentes

A estrutura do backend prevê:

- `SecurityConfig`
- `CustomUserDetailsService`
- `JwtAuthenticationFilter`
- componentes de geração/validação de JWT
- entidades de usuário e perfil

## Autorização

O sistema utiliza RBAC (Role-Based Access Control).

Perfis previstos:

- ADMIN
- GERENTE
- OPERADOR
- FINANCEIRO

As permissões devem ser aplicadas conforme o módulo e a operação.

### Cargos administráveis (V7)

O backend é a fonte de verdade. `perfil_pagina` contém as páginas concedidas
(`DASHBOARD`, `CLIENTES`, `PRODUTOS`, `PEDIDOS`; `ADMIN` apenas para o cargo
reservado). `CustomUserDetailsService` transforma cada página em uma autoridade
Spring `PAGE_*`; `SecurityConfig` exige a autoridade em todos os endpoints do
módulo, inclusive ao acessar uma URL manualmente. `ADMIN` é adicionalmente
necessário para `/api/admin/**` e para administrar usuários. O frontend também
filtra o menu e protege as rotas, mas essas verificações não substituem a API.

O nível de 1 a 99 representa hierarquia operacional, não herança de páginas.
Somente as ações especiais especificadas em `docs/decisoes.md` exigem nível 60.
O cargo `ADMIN` é fixo em 100, não editável; `OPERADOR` é editável exceto seu nome.
Ambos são não excluíveis. Atribuir um cargo ou editar permissões exige ADMIN.

O `JwtAuthenticationFilter` consulta o banco a cada requisição: edições das
páginas/nível de um cargo afetam imediatamente as próximas requisições, mesmo
com o cookie JWT anterior. Na troca de cargo de um usuário, sua
`credentialVersion` é incrementada, invalidando o JWT existente e exigindo
novo login. O frontend consulta `/api/auth/me` ao ganhar foco/visibilidade e
a cada 60 segundos; após revogação, o backend nega imediatamente o acesso,
mesmo antes do menu atualizar. Para rotas sem nenhuma página, há tela de
acesso indisponível.

## Segurança do cookie

O cookie de autenticação deve ser configurado com atributos adequados ao ambiente:

- `HttpOnly`
- `Secure` em produção
- `SameSite` conforme a arquitetura de frontend/backend
- tempo de expiração adequado

## Pontos de atenção

### CORS

Frontend e backend devem possuir configuração compatível com o envio de credenciais.

### CSRF

A estratégia deve ser avaliada junto ao uso de cookie de autenticação. Não assumir que desabilitar CSRF é sempre adequado quando credenciais são transportadas por cookie.

### Sessão

A API deve manter comportamento stateless quando JWT for utilizado como mecanismo principal de autenticação.

## Problemas históricos relevantes

Durante o desenvolvimento foram investigados:

- `401 Unauthorized` no login;
- `403 Forbidden` em endpoints autenticados;
- `LazyInitializationException` envolvendo `Perfil`;
- problemas de carregamento de variáveis `SPRING_DATASOURCE_*`.

Esses casos devem ser mantidos em `problemas.md` quando ainda forem relevantes.
