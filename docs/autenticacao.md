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
