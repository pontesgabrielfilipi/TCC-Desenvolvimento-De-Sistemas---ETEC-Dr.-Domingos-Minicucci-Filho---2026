# Configuracao por ambiente — AGERP

O arquivo `.env` na raiz controla **a interpolacao do Docker Compose**; o Compose repassa explicitamente apenas as variaveis de cada container em `environment`. Spring, Python e Nginx **nao** importam automaticamente o `.env` da raiz. Nunca execute `docker compose config` sem `--quiet` em logs compartilhados: a expansao mostra senhas.

Copie `.env.example` para um `.env` privado no computador de destino e troque os placeholders. O `.env` real existente **nao** deve ser sobrescrito, nem incluido em versionamento ou build. Para outros ambientes, use `docker compose --env-file arquivo-privado-do-ambiente.env ...` no mesmo diretorio/projeto. Sempre verifique `docker compose ls` e os nomes do volume e do projeto antes de subir, para nao inicializar acidentalmente outro PostgreSQL.

**Legenda:** `!` = obrigatoria pelo Compose; `d:` = default caso omitida (somente onde seguro); `S` = segredo; `R` = recriar servico; `B` = rebuild da imagem; `I` = apenas inicializacao de **volume vazio**; `L` = usada pelo Vite local (fora do Compose). Portas sao decimais; duracoes em `ms` = milissegundos, `s` = segundos e `m` = minutos; memoria/corpo em `m` = megabytes na sintaxe Nginx. `R` nao significa que `docker restart` aplica alteracoes: recrie.

| Variavel | Consumidor e finalidade | Obrigatoria/default; formato | Sensivel | Aplicacao |
| --- | --- | --- | --- | --- |
| `POSTGRES_USER` | Postgres: superusuario inicial | !, identificador SQL | N | I/R* |
| `POSTGRES_PASSWORD` | Postgres: senha inicial do usuario acima | !, segredo | S | I/R* |
| `POSTGRES_DB` | Postgres: banco inicial | !, nome SQL | N | I/R* |
| `SPRING_DATASOURCE_USERNAME` | Backend: login DB; Postgres init: papel da aplicacao | !, usuario | N | R/I* |
| `SPRING_DATASOURCE_PASSWORD` | Backend: credencial DB; Postgres init: senha inicial | !, segredo | S | R/I* |
| `SPRING_FLYWAY_USER` | Backend: conta proprietaria para Flyway | !, usuario SQL | N | R |
| `SPRING_FLYWAY_PASSWORD` | Backend: senha do Flyway | !, segredo | S | R |
| `SPRING_DATASOURCE_URL` | Execucao Spring pela IDE, fora do Compose | d: conforme configuracao IDE, JDBC | N | L |
| `AGERP_DOCKER_DATASOURCE_URL` | Backend no Docker: JDBC interno PostgreSQL | !, `jdbc:postgresql://postgres:5432/DB` | N | R |
| `SPRING_PROFILES_ACTIVE` | Backend: perfil `dev` ou `prod` | !, perfil Spring valido | N | R |
| `AGERP_BIND_ADDRESS` | Compose: IP de publicacao das 4 portas | d:`127.0.0.1`, IP; evite wildcard | N | R |
| `HOST_POSTGRES_PORT` | Compose: porta host PostgreSQL | !, 1–65535 | N | R |
| `HOST_FRONTEND_PORT` | Compose: porta host Nginx | !, 1–65535 | N | R |
| `HOST_APP_PORT` | Compose: porta host API Java; IDE: porta local | !, 1–65535 | N | R |
| `HOST_API_PORT` | Compose: porta host API Python | !, 1–65535 | N | R |
| `AGERP_CORS_ORIGINS` | Backend: origens autorizadas a enviar credenciais | !, URLs `http(s)://host[:porta]` separadas por virgula, sem barra final nem `*` | N | R |
| `AGERP_TRUSTED_PROXIES` | Backend: IPs/CIDRs de **peers diretamente confiaveis** para forwarded headers | d:vazio (nenhum); use preferencialmente IP exato do Nginx | N | R |
| `JWT_SECRET` | Backend: assinatura JWT | !, segredo aleatorio >=32 caracteres | S | R |
| `JWT_EXPIRATION` | Backend: validade JWT | d:`86400000`, ms positivos | N | R |
| `JWT_ISSUER` | Backend: emissor exigido nos JWTs | d:`agerp`, string nao vazia | N | R |
| `JWT_COOKIE_SECURE` | Backend: obrigar cookies Secure tambem em HTTP | !, `true` ou `false` | N | R |
| `JWT_COOKIE_SAME_SITE` | Backend: politica de cookies auth e CSRF | d:`Strict`, `Strict`/`Lax`/`None` (`None` requer Secure true) | N | R |
| `JWT_COOKIE_DOMAIN` | Backend: dominio opcional; vazio = host-only | d:vazio, dominio DNS | N | R |
| `AGERP_DEVICE_COOKIE_DAYS` | Backend: validade do cookie de dispositivo | d:`180`, 1–365 dias | N | R |
| `AGERP_SEED_ENABLED` | Backend: inicializacao opcional de dados | d:`false`, booleano | N | R |
| `AGERP_LOGIN_MAX_FAILURES` | Backend: limite de falhas de login | d:`10`, 1–1000 tentativas | N | R |
| `AGERP_LOGIN_WINDOW_SECONDS` | Backend: janela de bloqueio de login | d:`300`, 1–86400 s | N | R |
| `AGERP_IA_URL` | Backend: URL Python pela rede Docker | !, `http://python-ia-api:PORTA` | N | R |
| `AGERP_PYTHON_BIND_ADDRESS` | Python: interface TCP do Uvicorn | d:`0.0.0.0`, IP literal | N | R |
| `AGERP_PYTHON_INTERNAL_PORT` | Python: porta interna e healthcheck | d:`8000`, 1–65535; alinhar `AGERP_IA_URL` | N | R |
| `APP_WORKERS` | Python: processos Uvicorn | d:`1`, 1–8; o modelo reside em cada processo | N | R |
| `APP_RELOAD` | Python: autoreload, somente desenvolvimento | d:`false`, booleano; `true` exige 1 worker | N | R |
| `MODEL_DIR` | Python: pasta de artefatos da IA | d:`/app/model`, caminho absoluto | N | R |
| `AGERP_EXPORT_CORE_THREADS` | Backend: threads base executor MVC | d:`2`, 1–64 | N | R |
| `AGERP_EXPORT_MAX_THREADS` | Backend: maximo executor MVC | d:`4`, 1–64; >= core | N | R |
| `AGERP_EXPORT_QUEUE_CAPACITY` | Backend: fila executor MVC | d:`8`, 0–10000 | N | R |
| `AGERP_EXPORT_TIMEOUT_MS` | Backend: timeout do request MVC assincrono | d:`300000`, 1000–3600000 ms | N | R |
| `AGERP_EXPORT_CONCURRENT_LIMIT` | Backend: vagas simultaneas para XLSX | d:`3`, 1–64 | N | R |
| `SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE` | Backend: pool JDBC maximo | d:`10`, inteiro positivo | N | R |
| `SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE` | Backend: conexoes JDBC ociosas minimas | d:`2`, inteiro >=0 e <= max | N | R |
| `SPRING_DATASOURCE_HIKARI_CONNECTION_TIMEOUT` | Backend: timeout por conexao | d:`30000`, ms (Hikari exige >=250) | N | R |
| `LOGGING_LEVEL_ROOT` | Backend: nivel global de logs | d:`INFO`, nivel Spring | N | R |
| `LOGGING_LEVEL_COM_AGERP_AGERP` | Backend: nivel dos pacotes AGERP | d:`INFO`, nivel Spring | N | R |
| `AGERP_NGINX_PROXY_READ_TIMEOUT` | Nginx: inatividade ao ler upstream | d:`300s`, duracao Nginx | N | R |
| `AGERP_NGINX_PROXY_CONNECT_TIMEOUT` | Nginx: conexao ao backend | d:`30s`, duracao Nginx | N | R |
| `AGERP_NGINX_CLIENT_MAX_BODY_SIZE` | Nginx: limite do corpo HTTP | d:`10m`, tamanho Nginx | N | R |
| `AGERP_NGINX_TRUSTED_INGRESS_IP` | Nginx: IP **literal** do peer host/Tailscale medido, habilitado para `X-Forwarded-Proto:https` | !, IP unico; **nunca wildcard/CIDR** | N | R |
| `VITE_API_URL` | Bundle web: base de chamadas API (somente caminho relativo mesma origem; revisar antes de mudar) | d:`/`, caminho web, sem segredos | N | B |
| `AGERP_DEV_ALLOWED_HOSTS` | Vite **local**: DNS autorizados no Host header | d:vazio, dominios DNS separados por virgula | N | L |
| `AGERP_DEV_BIND_ADDRESS` | Vite **local**: interface de desenvolvimento | d:`0.0.0.0`, IP/hostname | N | L |
| `AGERP_DEV_PORT` | Vite **local**: porta de desenvolvimento | d:`5173`, 1–65535 | N | L |
| `AGERP_DEV_PROXY_TARGET` | Vite **local**: destino `/api` no host | d:`http://127.0.0.1:8080`, URL local | N | L |

`*` Alteracoes de usuarios, banco ou senhas de inicializacao **nao** mudam um PostgreSQL com volume existente. Para rotacionar credenciais, e necessaria uma operacao SQL planejada com backups, atualizacao da aplicacao e janela de corte. Nunca apague `pgdata` para aplicar `.env`. O endereco de bind Docker padrao protege as portas do acesso LAN; nao amplie sem avaliar firewall/autenticacao.

## Aplicar alteracoes com seguranca

1. Edite somente o arquivo de variaveis selecionado, preservando todos os segredos e o volume. `docker compose --env-file .env config --quiet` valida as variaveis obrigatorias **sem mostrar a configuracao expandida**. As validacoes de Spring, Python e Nginx ocorrem durante a inicializacao. Se trocar de arquivo, substitua `.env` por ele em cada comando.
2. `docker compose --env-file .env ps` e `docker inspect agerp-postgres` devem confirmar o projeto e o volume antes de qualquer recriacao. `docker compose --env-file .env build backend-api python-ia-api frontend` so e necessario quando codigo, Dockerfile ou config embutida na **imagem** mudarem. O Nginx usa template na imagem e interpolacao restrita `^AGERP_NGINX_` na inicializacao do container; as variaveis nativas `$host`, `$scheme`, `$remote_addr` continuam pertencendo ao Nginx.
3. Para mudar apenas variaveis operacionais, recrie os servicos afetados com `docker compose --env-file .env up -d --no-deps --no-build backend-api python-ia-api frontend` (omita servicos sem mudanca). Mudanca em `VITE_*` requer `build frontend` antes de `up -d --no-deps --no-build frontend`; alterar `.env` nao recompila JavaScript. Mudar `HOST_POSTGRES_PORT` requer recriar `postgres` **sem** `down -v` (avaliar impacto do acesso da IDE). Jamais use `docker compose down -v`, `volume prune` ou reinicializacao de DB.
4. Depois de recriar o **frontend**, o IP do container pode mudar. Inspecione `docker inspect agerp-frontend` e atualize `AGERP_TRUSTED_PROXIES` no arquivo privado com o IP exato do Nginx na rede AGERP, em seguida **recrie o backend**. Revalide tambem o IP de ingresso observado pelo Nginx (`AGERP_NGINX_TRUSTED_INGRESS_IP`): o proxy do host Docker Desktop pode mudar ao recriar a rede. Nenhum CIDR geral, `0.0.0.0/0`, wildcard CORS ou header arbitrario deve ser confiado.
5. Verifique `docker compose --env-file .env ps`, `curl` no frontend e nas health/readiness das APIs, CORS/CSRF/login autorizado, integracao Python e XLSX. Confirme que existem so `agerp-frontend`, `agerp-app`, `agerp-python`, `agerp-postgres` e que o volume PostgreSQL original permanece montado.

### Precedencia, HTTP local e HTTPS Tailscale

No Compose, variaveis exportadas no **shell** prevalecem sobre o arquivo `--env-file` ou `.env` usado na interpolacao. `--env-file arquivo` seleciona o arquivo a interpolar; na ausencia dele Compose le o `.env` padrao conforme as regras de diretorio/projeto da versao instalada. Entradas explicitas de `environment` no Compose passam aos containers o resultado interpolado e prevalecem sobre um eventual `env_file` do **servico** (que este projeto nao usa). Definir variavel no `.env` nao a injeta no container sem `environment` ou `env_file`. Nao use `docker compose config` sem `--quiet` para auditar em publico.

Para o ambiente atual, as tres origens exatas de `AGERP_CORS_ORIGINS` sao `http://localhost:5173`, `http://127.0.0.1:5173` e `https://noname.tailf69801.ts.net`. Tailscale Serve termina TLS na maquina e encaminha ao Nginx em `http://127.0.0.1:5173`. O IP de ingresso observado na instalacao inicial foi `172.18.0.1`; o Nginx so aceita `X-Forwarded-Proto:https` de peers configurados e substitui headers que chegam de clientes antes de encaminhar ao backend. O backend somente aceita os headers HTTPS quando o **IP do Nginx** estiver explicitamente em `AGERP_TRUSTED_PROXIES`. Em HTTP local e `JWT_COOKIE_SECURE=false`, cookies de autenticacao/CSRF nao sao Secure; na borda HTTPS confiavel, ambos devem ser Secure, independentemente do valor global. Ativar `JWT_COOKIE_SECURE=true` obriga Secure inclusive no acesso HTTP local, que deixara de autenticar no navegador. `SameSite=Strict` e cookies host-only sao o padrao. Mudancas em JWT issuer/secret invalidam tokens existentes, e alteracoes de dominio podem requerer limpar cookies antigos do navegador.

Nota para testes CORS: um `OPTIONS` enviado **pela propria origem** `https://noname.tailf69801.ts.net` ao mesmo host HTTPS pode responder `200` sem `Access-Control-Allow-Origin`, porque nao e uma solicitacao entre origens distintas. Para verificar a lista autorizada, envie `Origin: https://noname.tailf69801.ts.net` ao frontend HTTP local ou use uma das origens HTTP ao endpoint HTTPS; nesses casos deve existir `Access-Control-Allow-Origin` com a origem exata. Uma origem nao autorizada deve resultar em `403` e nao receber esse cabecalho.

O backend Java escuta **8080 dentro do container** e o Nginx usa `backend-api:8080`; `HOST_APP_PORT` muda somente a porta **publicada** no host Docker. Analogamente, os caminhos `/api` no navegador e os nomes de servico Docker permanecem constantes. Parametros de negocio configurados na interface/banco, inclusive timeout efetivo de previsao IA, nao migram para `.env`.
