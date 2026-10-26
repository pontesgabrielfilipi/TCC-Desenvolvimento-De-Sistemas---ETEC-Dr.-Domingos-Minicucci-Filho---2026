# Autenticação e Segurança

## A03 — Sessões persistidas, revogação e transição

Desde a migração V10, um login aprovado cria `sessao_autenticacao` com UUID aleatório,
usuário, instantes de criação/expiração, dispositivo lógico opcional e revogação.
JWTs assinados incluem `sid` e `jti` aleatório; não são guardados no banco.
Cada requisição carrega novamente usuário/permissões do banco e confere assinatura,
expiração, `sid` persistido e não revogado, usuário ativo/aprovado e
`credentialVersion`. Alteração de cargo/email/senha continua invalidando todos
os JWTs anteriores pela versão. A API não utiliza refresh token.

`POST /api/auth/logout` revoga apenas o `sid` da credencial apresentada, remove
o cookie e é idempotente. `GET /api/auth/sessions` lista as próprias sessões,
`DELETE /api/auth/sessions/{uuid}` revoga uma delas. ADMIN pode consultar/revogar
sessões de outro usuário em `/api/auth/admin/users/{id}/sessions` e
`/api/auth/admin/users/{id}/sessions/{uuid}`; usuário não administrador recebe
403 e sessão não pertencente ao usuário recebe 404 (sem confirmação de existência).
Mantenha CSRF em métodos mutáveis.

O cookie `jwtToken` é HttpOnly, SameSite=Strict, Path=/, Secure em HTTPS ou com
`JWT_COOKIE_SECURE=true`, e dura até a expiração do JWT. `agerpDevice` é outro
cookie first-party, HttpOnly, SameSite=Strict, Path=/, com a mesma política de
Secure e duração de 180 dias. É um UUID aleatório de navegador, não um
fingerprint; apagá-lo gera novo identificador. Não é usado para autenticação,
autorização ou bloqueio; IP e User-Agent podem variar livremente.

**Transição**: JWTs emitidos antes da V10 não possuem `sid`; são recusados,
sem criação implícita de sessão. Usuários precisarão fazer login novamente
após a atualização. A migração é aditiva e não atribui identidade a logs antigos.
As configurações `agerp.security.login.max-failures` (padrão 10) e
`agerp.security.login.window-seconds` (padrão 300) limitam falhas por combinação
de IP e email tentado, sem bloquear globalmente a conta. Esse limitador é
local à instância: produção com múltiplas réplicas exige limitação distribuída
e proteção complementar na borda. Não são gravados tokens nem senhas nos logs.


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

O JWT continua em cookie `HttpOnly`, `SameSite=Strict`, `Secure` quando HTTPS ou `JWT_COOKIE_SECURE=true`.
Como o navegador envia cookies automaticamente, a API exige CSRF em POST/PUT/PATCH/DELETE,
inclusive login e logout. `GET /api/auth/csrf` emite `XSRF-TOKEN` e retorna o token
no JSON. O React consulta essa rota antes de cada operação mutável e envia
`X-XSRF-TOKEN`. Clientes HTTP que não utilizam o React precisam repetir este
handshake na mesma sessão de cookies. Requisições sem token ou com token incorreto
recebem 403. GET/HEAD/OPTIONS não exigem CSRF; preflight não exige autenticação.

### Origem confiável e proxies

`ClientIpResolver` utiliza `getRemoteAddr()` como origem da conexão, com
`server.forward-headers-strategy=none`, para que o Spring não reescreva o peer
antes da auditoria. Apenas peers listados em `AGERP_TRUSTED_PROXIES` podem
fornecer `X-Forwarded-For`; a cadeia é examinada da direita para a esquerda,
parando no primeiro endereço não confiável. Cabeçalhos alternativos `Forwarded`,
`X-Real-IP` ou `CF-Connecting-IP` junto a uma solicitação encaminhada são
ignorados para fins de identidade; cadeias inválidas ou extensas retornam o peer.
O Nginx substitui o XFF recebido pelo endereço de seu próprio peer, removendo
alegações externas. Endereços privados e `100.64.0.0/10` **não** são confiáveis
automaticamente e não comprovam Tailscale.

Os fluxos são: acesso direto ao backend -> peer TCP; navegador -> Nginx ->
backend -> peer validado do Nginx e XFF substituído; Tailscale Serve -> Nginx
-> backend -> o peer visto pelo Nginx (não assumir identidade final sem prova);
Cloudflare opcional -> fronteira configurada e autenticada -> Nginx -> backend.
Cloudflare não está habilitado por padrão: não usar `CF-Connecting-IP` como
identidade sem restringir e verificar a conexão upstream e configurar a borda.
Não publique o backend diretamente em interfaces externas nem habilite confiança
genérica em redes Docker ou de VPN.

Para HTTPS terminado antes do Nginx, configure `JWT_COOKIE_SECURE=true`.
O Nginx reconhece `X-Forwarded-Proto: https` somente de upstream loopback,
e não aceita esse header de clientes remotos. `TrustedSchemeFilter` reconstrói
`isSecure()` e `getScheme()` para requisições HTTPS somente quando o peer do
backend é explicitamente confiável, sem alterar `getRemoteAddr()`.
Se a instalação do Tailscale Serve
chegar ao contêiner por outro IP, o TLS externo continua ativo mas o esquema
interno não será reconhecido automaticamente: configure explicitamente a borda
após comprovar o peer real. Não amplie a lista de confiança por conveniência.

CORS possui uma única fonte em `AGERP_CORS_ORIGINS`: lista de origens exatas,
separadas por vírgula, sem wildcards e sem barra final. Frontend no mesmo host
via Nginx/Vite não precisa de CORS. Origens externas devem ser autorizadas
individualmente e a configuração inválida impede a inicialização.

### Sessão

A API deve manter comportamento stateless quando JWT for utilizado como mecanismo principal de autenticação.

## Problemas históricos relevantes

Durante o desenvolvimento foram investigados:

- `401 Unauthorized` no login;
- `403 Forbidden` em endpoints autenticados;
- `LazyInitializationException` envolvendo `Perfil`;
- problemas de carregamento de variáveis `SPRING_DATASOURCE_*`.

Esses casos devem ser mantidos em `problemas.md` quando ainda forem relevantes.
# Correlação e privacidade de auditoria (A02)

O servidor gera `request_id` (UUID) e devolve `X-Request-ID` para diagnóstico. `X-Correlation-ID` recebido do cliente é aceito apenas quando tiver de 1 a 64 caracteres ASCII `[A-Za-z0-9_-]`; caso contrário o valor interno do request é utilizado. Um correlation ID válido é identificador de correlação, **não** prova de identidade nem autenticação. `peer_ip` representa a conexão recebida; `ip` representa o endereço obtido pelo resolvedor confiável A01. A rota é normalizada e não inclui query string. `User-Agent` é sanitizado e limitado; não salvar cookies, Authorization, query strings, tokens, credenciais ou corpo completo.

Eventos de domínio e suas alterações bem-sucedidas devem compartilhar transação; falhas/negações podem ter evento independente. Referências de sessão e dispositivo são nulas em registros legados e acessos anônimos; eventos de sessões A03 novas podem ser correlacionados. Métodos, rota e origem são fatos observáveis no início da requisição; status e duração só podem ser registrados depois da resposta, em evento correlacionado próprio se futuramente necessário. `AuditRequestContext.wrap` propaga snapshot imutável e MDC em trabalho assíncrono explícito, limpando-os ao terminar. Não transportar `HttpServletRequest` nem entidades JPA a threads posteriores.
