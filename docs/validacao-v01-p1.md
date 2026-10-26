# V01 — P1 — Validação da evolução de auditoria (24/10/2026)

## Adendo vigente: validação autenticada do deploy V02 de TESTES (25/10/2026, ~11:00 BRT)

**Resultado: 1/1 PASS (Playwright Chromium, 14,3 s) pelo Nginx REAL
`http://127.0.0.1:5173`, sem mocks.** Este adendo substitui apenas a pendência
"autenticação ainda não executada neste deploy" do registro de ~06:35 abaixo.
O deploy já estava atualizado; nesta etapa não houve rebuild, restart ou
modificação do código funcional. **V01 continua parcial e produção não homologada.**

**Pré-condições verificadas antes das escritas:** projeto Compose
`tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026`,
PostgreSQL 16 `agdb`/volume homônimo `_pgdata`, Nginx apenas loopback,
backend JDBC apontando para esse banco e containers ativos. Flyway V9/V10
aplicadas; backend, PostgreSQL e Python healthy, frontend Up. Imagens utilizadas:
backend `sha256:758ed5d9581a40d7c576a8ea6b127ffb2fffc55aa2e61b686d3197fe46c4f90a`,
frontend `sha256:7d629275530cc97cc332204be97dbbe446254c23d59856740831e0a14a167548`,
PostgreSQL `sha256:1a6ab3f5345eb6dbe04a1349529caabdb0ab09293a09590fad07b2246bfa4b54`,
Python `sha256:e6ddcc88671d1d193660fa8e5f10e7f7a145c39fc1f19ad674a63f7dc5477d46`.

```powershell
cd agerp-frontend
$env:E2E_BASE_URL='http://127.0.0.1:5173'
$env:E2E_TEST_DEPLOY_AUTH='I_AUTHORIZE_TEST_ACCOUNTS'
npx playwright test tests/e2e/v02-deployed-authenticated.spec.ts --project=chromium --reporter=line
```

**Atenção:** reexecução cria **novos** dados descartáveis e exige autorização
para o banco de testes; o spec verifica as imagens, porta, banco e volume antes
de escrever e aborta se o alvo mudar. Segredos gerados aleatoriamente ficam
só em memória; screenshots, vídeos e traces estão desativados. Cadastro inicial
pela API preserva BCrypt; a promoção exclusiva do novo ADMIN usou bootstrap SQL
condicionado ao ID/email/status da própria conta de teste, como no harness
isolado, sem auditoria de aplicação para esse `UPDATE` direto. Aprovação e
bloqueio do OPERADOR ocorreram por API. Usuários anteriores não foram alterados.

| Caso | Resultado e evidência observada | Limite |
| --- | --- | --- |
| CSRF, logins ADMIN e OPERADOR, credenciais inválidas | **PASS**: 200 para login com CSRF válido, 403 esperado sem CSRF, 401 esperado com senha errada/CSRF válido; cookie HttpOnly | `Secure=false` exclusivamente no HTTP de testes |
| Permissões e URLs diretas | **PASS**: operador 403 em `/api/admin/logs`, relatórios e XLSX; navegação direta `/admin` redirecionada; ADMIN 200 nos endpoints | Não equivale à revisão completa de todas as telas |
| Sessões, logout, revogação/replay | **PASS**: 2 sessões ADMIN independentes, logout invalida uma, replay recebe 401; outra continua ativa; ADMIN revoga sessão OPERADOR, que recebe 401 | Expiração pelo relógio não foi provocada nesta execução; coberta em teste isolado anterior |
| Pedido, estoque, eventos auditados | **PASS**: cliente ID 62, produto ID 62, pedido ID 99 com total 71,00; PENDENTE→CONFIRMADO→CANCELADO, estoque 7→5→7, 2 movimentos, eventos auditados de cliente/produto/pedido/status/estoque | Dados sintéticos mantidos para rastreabilidade |
| IA integrada | **PASS online**: endpoint de previsão do pedido retornou `SUCESSO`, não fallback | Falha/timeout de rede reais pendentes |
| XLSX via Nginx autenticado | **PASS na amostra**: catálogo de 39 relatórios, 3 XLSX de cadastro de clientes parseados (filtro com cliente, filtro vazio e sem filtro), mais XLSX de exportações; conteúdo e exclusão de autoalimentação verificados | Parser SheetJS sinalizou avisos ZIP `Bad uncompressed size` apesar da leitura; outros leitores/streaming lento pendentes |
| Logs e saúde após execução | **Sem erro inesperado detectado**: amostras dos últimos 30 min (backend 1.000 linhas, Nginx 72, Python 178, PostgreSQL 0), 0 marcadores de erro HTTP 5xx/exceção e 0 warnings na amostra; serviços ativos | Inspeção amostral de logs, não monitoração contínua |

**Limpeza e evidência pós-teste:** contas novas IDs 62 (ADMIN) e 63
(OPERADOR), ambas `ativo=false`, `status_acesso=BLOQUEADO`; **0 sessões
ativas**, **4 revogadas**, **31 registros de auditoria** associados aos dois
IDs, confirmado em consulta independente à instância `agdb`. Logout e
revogação por API encerraram sessões; fallback SQL de revogação de sessões
residuais atingiu **0**. ADMIN foi desativado por SQL restrito ao próprio ID
de teste, com incremento de `credential_version`, porque o sistema proíbe
autobloqueio. Permanecem cliente 62, produto 62 e pedido cancelado 99,
movimentos e logs; nada preexistente foi apagado. Sem commit, push, pull,
merge, rebase, tag ou troca de branch.

**Parecer separado:** (1) fluxos autenticados desta amostra de **testes
PASS**, sem defeito funcional novo comprovado; (2) nenhum bloqueio para os
fluxos executados, mas interoperabilidade XLSX assinalada por warnings;
(3) produção **NÃO PRONTA / NÃO HOMOLOGADA** enquanto faltarem testes de
cancelamento/streaming XLSX e backpressure, timeout/queda Python real,
acessibilidade com leitor de tela, carga/concorrência adicional, variações
legadas/política temporal, perfil/TLS/cookies/CORS/proxy de produção,
deliberação A07 e estratégia recuperável compatível com V10. A compatibilidade
da imagem antiga com V10 **não foi validada**. Demais resultados isolados,
incluindo 160/160 Maven, 6/6 Playwright e 39 formatos POI, permanecem
evidências próprias e **não foram reexecutados aqui**.

---

## Adendo vigente de operação: V02 atualizada SOMENTE no ambiente de testes (25/10/2026, ~06:35 BRT)

**V01 permanece parcialmente homologada; V02 foi implantada no Compose original
exclusivo de TESTES por autorização expressa, sem autorização de produção.**
O parecer abaixo, redigido antes da atualização, continua válido sobre o escopo
dos testes V01, mas suas afirmações "V02 não implantada", "sem migrações no
original" e "não autorizada" estão **superadas somente para o ambiente de testes**.
Consulte `docs/docker.md` (primeira seção) para configuração efetiva, IDs completos
de imagens, backup, migrations e comando reproduzível de smoke.

- Nginx efetivamente atualizado: `http://127.0.0.1:5173`, apenas loopback.
  `backend-api` e `frontend` recriados; `postgres` e `python-ia-api` preservados.
  Schema do banco de testes `agdb` atualizado via Flyway para **V10**,
  aplicando **V9/V10** sem conversão temporal. Volume `pgdata` original mantido.
  Os 107 logs históricos com `event_id` nulo foram preservados; grants
  de `log_sistema` permanecem limitados a SELECT/INSERT para `aguser`.
- E2E **no deploy efetivamente atualizado**, sem mocks HTTP:
  `agerp-frontend/tests/e2e/v02-deployed-smoke.spec.ts`, Playwright Chromium,
  Firefox e WebKit **12/12 PASS**. SPA 200, CSRF 200 e cookie, POST login
  sem CSRF 403 esperado, com CSRF e credenciais inválidas 401 esperado;
  GET `/api/auth/me` anônimo 401, CORS local restrito, headers forjados
  sem privilégio. A API Python original previu **8–15 dias** em POST
  `/predict` sintético real (não prova fallback do pedido autenticado).
- **NÃO EXECUTADOS NO DEPLOY ATUALIZADO:** login autorizado com conta real,
  ADMIN/OPERADOR, sessão/revogação, escrita pedido/estoque/auditoria autenticada
  e download/abertura XLSX pelo Nginx. Não havia credenciais de teste autorizadas;
  nenhuma senha foi redefinida, ADMIN criado ou teste de escrita efetuado.
  Evidências da stack **isolada anterior** seguem aprovadas: Maven PG16
  **160/160**, frontend unitário **4/4**, lint/build, Python **2/2** e
  Playwright autenticado **6/6**, quatro XLSX via Nginx. Não transferir a
  classificação "aprovado" desses fluxos para o deploy atualizado.
- **Pendências mantidas:** cancelamento streaming XLSX observado no backend;
  indisponibilidade/timeout Python por rede ponta a ponta; acessibilidade com
  leitor de tela e cenários adicionais de concorrência/carga/legado. A07 não
  ampliada. Compatibilidade da imagem antiga com V10 não comprovada e não
  necessária para este deploy de testes; imagem antiga sozinha não é rollback.

**Parecer vigente:** deploy de **testes** atualizado, disponível e saudável;
smoke técnico **aprovado com limites**; V01 **parcial**; autenticação funcional
e XLSX no deploy atualizado **pendentes**; produção **não homologada**.

---

### Histórico de parecer anterior ao deploy de testes

## Parecer vigente — candidata com lock de último ADMIN (25/10/2026, ~05:40 BRT)

**Este parecer prevalece sobre todos os adendos cronológicos abaixo.** A candidata A04
foi corrigida e revalidada em ambiente isolado, mas **a V01 não está homologada
integralmente e a V02 não foi implantada**. Nenhum teste autoriza alterações nos
quatro serviços originais `agerp-postgres`, `agerp-app`, `agerp-python` e
`agerp-frontend`. Backups, bancos, redes e volumes existentes foram preservados.

### Identidade verificável e alcance das evidências

- Branch `dev`; HEAD/base `944e01ec86cebfb881ba1f673c927b1c1aeb7e18`, com
  mudanças locais pré-existentes **sem commit**. `git status --short` e
  `git diff --stat` consultados. Não identificar a candidata somente pelo HEAD.
- Manifesto local de **256 arquivos** de `src/main`, `src/test`,
  `agerp-frontend/src`, `agerp-frontend/tests`, `services/python-ia/tests` e dos
  arquivos `agerp-frontend/nginx.conf`, `docker-compose.yml`, `pom.xml`,
  `services/python-ia/Dockerfile`, `agerp-frontend/playwright.config.ts`:
  SHA-256 `a1480be01a1c8c2826a20e210ffe7423b2226fe101f5928cf3f974095985a190`
  (cada entrada `caminho/relativo<TAB>sha256-minúsculo`, ordenação `Sort-Object`,
  união por LF sem LF final, hash SHA-256 sobre UTF-8). É impressão da **árvore
  de código/testes atual**; o manifesto histórico `baa33dbd...` e o do turno
  anterior `ba784a...` estão superados. Documentos não integram o hash.
- **Backend executável** isolado `agerp-v01-adminlock-backend-20261025`, imagem
  `agerp-v01-candidate-adminlock:20261025-0500`, ID
  `sha256:1b0ac55c99d4ef9326cb64cb3cf3ecd1a2a64e2069a338ba635ce1383851ba54`;
  Nginx `agerp-v01-adminlock-nginx-20261025`, imagem
  `agerp-v01-frontend:20261025-0345`, ID
  `sha256:78ef91e1f27b3cede6bc8fa37ba43a6aeb756b8da74b36652ffbf0e64f90e328`,
  acesso **somente** `http://127.0.0.1:53993`; Python real isolado
  `agerp-v01-python-20261025`, imagem `sha256:e6ddcc88671d1d193660fa8e5f10e7f7a145c39fc1f19ad674a63f7dc5477d46`.
  O código executável das imagens não mudou depois desse build; a alteração
  posterior foi em spec Playwright e documentação. Os testes Java usaram a árvore
  atual e PostgreSQL 16 descartável por Testcontainers.
- Banco dos E2E: `agerp-v02-pg-net-20261025-0025`, volume **exclusivo**
  `agerp-v02-netpg-data-20261025-0025`, rede
  `agerp-v01-adminlock-net-20261025-0510`, sem publicação da porta PostgreSQL.
  O spec faz guard de banco, volume, rede, imagem, JDBC e porta antes de escrever.
  Em `docker ps` de 25/10, os quatro serviços **originais** permaneciam ativos;
  esta etapa não os reiniciou, reconstruiu, migrou nem atualizou.

### Execuções finais e evidências (não confundir aprovados com bloqueados)

| Teste / comando reproduzível | Resultado | Evidência e limite |
| --- | --- | --- |
| `mvn.cmd -o "-Dmaven.repo.local=C:/Users/filip/.m2/repository" test` (raiz; Maven instalado, já que o wrapper não estava disponível offline) | **160/160 PASS, 0 falhas, 0 erros, 0 pulados; BUILD SUCCESS** às 05:27 BRT | `C:/tmp/agerp-adminlock-mvn-suite.stdout.log` e `target/surefire-reports/`. PostgreSQL 16/Testcontainers; inclui 3 casos de usuário/perfil, 2 pedidos/estoque, 1 configuração e 4 de rollback/falha/concor­rência. Substitui a evidência antiga da suíte 156/156 e os XMLs isolados com timeout. |
| `cd agerp-frontend; node --test tests/unit/httpError.test.mts` | **4/4 PASS; exit 0**, reexecutado | Saída do comando em 25/10; `npm test` **não** é script do projeto. |
| `cd agerp-frontend; npm run lint` | **PASS; exit 0**, reexecutado | ESLint sem erros. |
| `cd agerp-frontend; npm run build` | **PASS; exit 0** (inclui `tsc -b`, Vite 8.1.0 em 4,32 s), reexecutado | Bundle JS 1.202,75 kB: aviso de tamanho, não falha. |
| `cd services/python-ia; python -m unittest discover -s tests -v` | **2/2 PASS; exit 0**, reexecutado | Testa health e normalização da API Python; não substitui integração de falhas via rede. |
| `cd agerp-frontend; $env:E2E_ISOLATED_BASE_URL='http://127.0.0.1:53993'; $env:E2E_BASE_URL=$env:E2E_ISOLATED_BASE_URL; npx playwright test tests/e2e/v02-isolated-authenticated.spec.ts tests/e2e/v02-isolated-csrf.spec.ts --project=chromium --project=firefox --project=webkit --workers=1 --reporter=line` | **6/6 PASS (1 min)**, dois testes por navegador, Nginx/backend/PostgreSQL/Python reais, sem interceptação HTTP mockada | `C:/tmp/agerp-adminlock-final-3browsers.stdout.log`. Login, CSRF, cookies, duas sessões, revogação/replay/expiração, RBAC/URLs, CRUD/pedido 7→5→7/auditoria, 39 relatórios no catálogo, 4 XLSX e axe 390/1280. Testes com mocks anteriores seguem evidência de UI, **não** de integração. |
| Cancelamento via socket HTTP no mesmo spec, antes de consumir o body do XLSX | **Fechamento real do lado cliente e 0 arquivos temporários residuais**, nas três execuções. Estados `SOLICITADA`, `GERADA`, `TRANSMISSAO_ENCERRADA` | Log `V01_HTTP_ABORT tempFilesBefore=0 tempFilesAfter=0 clientDeliveryUnverified=true`; Nginx pode ter terminado buffering/transmissão ao backend. **Não comprovou notificação de desconexão ao backend nem liberação de conexões durante streaming lento**; `TRANSMISSAO_ENCERRADA` não significa entrega ao cliente. `AdminRelatorioExportControllerTest` cobre falha de `write` com registro de FALHA. |
| Python real `/predict` pela candidata; `IaPrevisaoFallbackTest` na suíte Maven | **Online `SUCESSO`**, fallback/timeout/erro HTTP em 3/3 testes Java | Três navegadores reportaram `V02_IA_ISOLATED result=SUCESSO`. A indisponibilidade real de container e timeout em rede ponta a ponta **não** foram provocados no E2E. |
| 600 GET autenticados `/api/admin/logs`, concorrência 5 **por navegador**, no Nginx isolado | Chromium p95 **34,51 ms**, Firefox **33,89 ms**, WebKit **33,96 ms**, **0 erros** em cada lote | Mesma saída Playwright; medições de leitura **não** representam SLA nem capacidade de produção. Ryzen 5 5500U, 12 CPUs lógicas; Docker ~7,436 GiB; backend amostrado ~528–593 MiB. |
| V9/V10 em banco novo e restauração de cópia, grants limitados, 39 XLSX via Apache POI | **Provas anteriores válidas**, sem repetição destrutiva | Cópia PG16: 17 tabelas, 649 logs (107 históricos com `event_id NULL`), sem FKs inválidas; conta restrita permite SELECT/INSERT e recusa UPDATE/DELETE/TRUNCATE; 39 formatos reabertos pelo POI. No proxy, 4 XLSX com 11 entradas/11 descritores ZIP64 cada. Avisos SheetJS 0.18.5 permanecem documentados. |
| Compatibilidade da imagem **antiga** com schema V10 da cópia isolada | **BLOQUEADO; NÃO EXECUTADO** | Houve recusa explícita de segurança ao iniciar imagem antiga nesse cenário; cópia V10, dump e globals preservados. Não contornar a recusa; rollback de imagem isolado **não está validado**. |

### Pendências e classificação atual

- **Defeito relacionado corrigido e comprovado:** a corrida entre dois ADMINs
  que bloqueiam um ao outro poderia deixar zero aprovados; `PerfilRepository`
  agora oferece lock pessimista no perfil `ADMIN` e `UsuarioService` serializa a
  validação. `UsuarioPerfilAuditoriaConcorrenciaIntegrationTest` 3/3, incluindo
  **um commit, uma recusa, um ADMIN remanescente e somente um evento confirmado**.
  Corridas de pedidos/estoque, usuário/perfil e configuração também passaram nos
  limites dos cenários executados. Falhas iniciais de fixture/consulta em testes
  foram corrigidas anteriormente; não são defeitos de produto remanescentes.
- **Teste técnico parcial:** cancelamento de XLSX com streaming lento, backend
  detectando desconexão e controle de conexões ativas; ensaio de indisponibilidade
  e timeout do serviço Python por rede ponta a ponta; volume de exportações maior,
  leitores XLSX independentes, variações legadas, teclado/leitor de tela real,
  cenários adicionais de erro e concorrência. Necessários para encerrar a matriz
  integral; os testes bem-sucedidos não provam esses itens.
- **Bloqueio de ferramenta:** execução funcional da imagem antiga com V10
  recusada; **não aprovado** login, escrita, auditoria ou relatórios desse rollback.
  Menor ação: autorização legítima no mecanismo que fez a recusa; sem caminho
  alternativo nem mudança em grants/segurança.
- **Dependências humanas:** (1) terceiros/janela/interrupção/rollback;
  (2) URL e caminho HTTPS/Tailscale/proxies IPs exatos; (3) origens CORS exatas;
  (4) perfil dev/prod e `JWT_COOKIE_SECURE` coerentes com acesso real;
  (5) fuso/interpretação de timestamps históricos sem conversão retroativa;
  (6) inclusão ou exclusão de A07. Nenhuma foi presumida resolvida.

**Três pareceres separados:** **A04 — implementada substancialmente e aprovada
nos cenários transacionais ensaiados, ainda não exaustiva**; **V01 — homologação
isolada parcial**, com regressão atual verde e pendências acima explícitas;
**V02/deploy real — NÃO PRONTO, NÃO CONCLUÍDO e NÃO AUTORIZADO**. Sem commit,
push/pull, migrations ou reinícios no ambiente original.

**Parecer: NÃO PRONTO PARA DEPLOY como release integral A01–A06.** Os testes automatizados executados passaram após quatro ajustes de testes, porém os bloqueios e lacunas abaixo impedem comprovar os 13 itens de aceite. Um resultado verde de Maven/Playwright **não equivale** à homologação integral. A07 não foi homologada como parte da release.

## Ambiente, segurança e reprodução

- Host: Windows, PowerShell, Java 25, Maven 3.9.9, Node.js/npm, Python, Docker Desktop com PostgreSQL `postgres:16-alpine` do Testcontainers. CPU identificada no registro do Windows: **AMD Ryzen 5 5500U with Radeon Graphics**; 12 processadores lógicos expostos ao processo. RAM física **não aferida** neste ambiente; não presumir hardware de produção.
- Branch observada: `dev`, árvore de trabalho já extensamente modificada antes da V01. **Nenhum commit, push, pull, merge, rebase, tag, troca de branch, `docker compose up` ou remoção de volume foi executado** nesta V01.
- Executar apenas com Docker local acessível e projeto de testes apontando para container novo/descartável. Antes de reexecutar, conferir `src/test/java/com/agerp/agerp/TestcontainersConfiguration.java`, `src/test/resources/db/test/create-audit-role.sql` e variáveis/`application*.properties`. **Proibido direcionar testes que fazem `TRUNCATE`, seed ou alterações de roles para o banco real.**
- O wrapper `./mvnw.cmd -o test` tentou baixar a distribuição Maven 3.6.3 em cache não disponível; execução pelo Maven instalado 3.9.9 com repositório existente (offline). Execução de Testcontainers inicialmente bloqueada por acesso ao `\\.\pipe\docker_engine` no sandbox; uma execução com acesso ao Docker foi realizada e passou. Não tratar essas tentativas como testes aprovados.
- O frontend tem scripts `build`, `lint`, `test:e2e` e **não possui `npm test`**. Testes unitários `.mts` usam `node --test` diretamente. Testes reais do browser exigem credenciais descartáveis para usuário ADMIN e OPERADOR e backend/API real separados de produção.

### Comandos reproduzíveis (a partir da raiz do repositório)

```powershell
git status --short
git diff --stat
Get-Content agerp-frontend/package.json
Get-Content agerp-frontend/playwright.config.ts

# Windows: wrapper primeiro; falhou por falta de distribuição no cache offline.
.\mvnw.cmd -o test

# Alternativa usada com Docker/Testcontainers autorizado e repositório local offline.
mvn -o "-Dmaven.repo.local=C:/Users/filip/.m2/repository" test
mvn -o "-Dmaven.repo.local=C:/Users/filip/.m2/repository" "-Dtest=AuditContextFilterFlowTest,AuditRestrictedRoleIntegrationTest" test
mvn -o -l target/v01-performance.log "-Dmaven.repo.local=C:/Users/filip/.m2/repository" "-Dtest=AuditQueryPerformanceIntegrationTest" test

Push-Location agerp-frontend
node --test tests/unit/httpError.test.mts
npm run build
npm run lint
npm run test:e2e -- --project=chromium
Pop-Location

Push-Location services/python-ia
python -m unittest discover -s tests -v
Pop-Location
```

Para Playwright integrado real (ainda **não executado** com credenciais e backend real), preparar **somente banco descartável**, executar backend e frontend apontando para ele e configurar `E2E_BASE_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_USER_EMAIL` e `E2E_USER_PASSWORD`. Em `navigation.spec.ts`/`tables.spec.ts`, os cenários condicionais não são registrados na ausência das variáveis. **Não usar credenciais, contas ou banco de produção.** O `npm run test:e2e` normal pode iniciar apenas o Vite e testes com `page.route`/`route.fulfill` (mocks), o que não confirma integração real.

## Execução observada

| Teste | Comando / procedimento | Resultado comprovado | Evidência local |
| --- | --- | --- | --- |
| Backend completo, PostgreSQL 16 e Flyway | `mvn -o -l target/v01-full-mvn-147.log "-Dmaven.repo.local=C:/Users/filip/.m2/repository" test` | **147/147 PASS** às 21:09:23, 1m43s, incluindo os cinco testes acrescentados; Testcontainers `postgres:16-alpine`. Execuções anteriores 142/142 e 146/146 também passaram | `target/v01-full-mvn-147.log`, `target/v01-full-mvn-final.log`, `target/v01-full-mvn.stdout.log`, `target/surefire-reports/TEST-*.xml` |
| Segurança IP/proxy no encadeamento de filtros e grants com conexão restrita | `mvn -o ... "-Dtest=AuditContextFilterFlowTest,AuditRestrictedRoleIntegrationTest" test` | **4/4 PASS**; `aguser` LOGIN no DB descartável, SQLSTATE `42501` em `UPDATE`/`DELETE`/`TRUNCATE`; 3 casos `TrustedSchemeFilter` + `AuditContextFilter` | `target/surefire-reports/com.agerp.agerp.security.AuditContextFilterFlowTest.txt`, `.../com.agerp.agerp.AuditRestrictedRoleIntegrationTest.txt` |
| Paginação de logs com 10.000 eventos sintéticos | `mvn -o -l target/v01-performance.log ... "-Dtest=AuditQueryPerformanceIntegrationTest" test` | **1/1 PASS**; 10.000 linhas, página de 50, 5 warmups, 30 amostras, p50 **25,729 ms**, p95 **28,536 ms**, máximo **31,601 ms** | `target/v01-performance.log`, `target/surefire-reports/TEST-com.agerp.agerp.AuditQueryPerformanceIntegrationTest.xml` |
| Relatórios HTTP + XLSX e async | `RelatoriosIntegrationTest`, incluído na suíte Maven | **9/9 PASS**; percorreu os **39** IDs do catálogo com/sem filtros aplicáveis, XLSX reaberto com Apache POI, vazios, totais, acessos e auditoria da exportação | `target/surefire-reports/TEST-com.agerp.agerp.RelatoriosIntegrationTest.xml` |
| Falha/interrupção de exportações | `AdminRelatorioExportControllerTest`, incluído na suíte Maven | **2/2 PASS** nos cenários simulados de falha antes dos headers e interrupção de transmissão | `target/surefire-reports/TEST-com.agerp.agerp.controller.AdminRelatorioExportControllerTest.xml` |
| Frontend unitário `.mts` | `node --test tests/unit/httpError.test.mts` | **4/4 PASS** | saída do comando; arquivo `agerp-frontend/tests/unit/httpError.test.mts` |
| Frontend build | `npm run build` | **PASS**, advertência de bundle ~1,2 MB | saída do Vite/TypeScript no terminal |
| Frontend lint | `npm run lint` | **PASS** | saída ESLint no terminal |
| Browser Chromium | `npm run test:e2e -- --project=chromium` | **81/81 PASS** em ~3m30s, **majoritariamente com interceptação/mock de API**. Não classificar como teste de backend real autenticado | `target/v01-e2e-chromium.stdout.log`; `agerp-frontend/test-results/.last-run.json` |
| Python IA | `python -m unittest discover -s tests -v` em `services/python-ia` | **2/2 PASS**, não substitui teste ponta a ponta do fallback do Spring | `services/python-ia/tests/test_api.py` e saída do comando |
| Playwright real autenticado ADMIN/OPERADOR | Variáveis `E2E_*` + frontend/proxy/backend e banco descartáveis | **NÃO EXECUTADO**, ambiente/credenciais de teste não demonstrados | testes condicionais `agerp-frontend/tests/e2e/navigation.spec.ts`, `tables.spec.ts` |
| Migração em cópia sanitizada de versão anterior | Dump sanitizado em banco descartável e `mvn test`/Flyway | **NÃO EXECUTADO**, snapshot sanitizado indisponível | `src/main/resources/db/migration/V9__auditoria_correlacionada.sql`, `V10__sessoes_rastreaveis.sql` |
| Concorrência e rollback de fluxos A04 pendentes | Testes multi-thread / falha de auditoria sob transação | **PARCIAL**, cobertura pontual não cobre todos os serviços | `docs/auditoria-negocio.md` |

Os logs `target/` e `test-results/` são artefatos locais de execução; não presumir sua existência em outro clone. Evidências versionáveis são os arquivos de teste e esta documentação.

## Matriz obrigatória de aceite

**Legenda:** PASS = há prova automatizada do aspecto descrito; PARCIAL = parte coberta; BLOQUEADO = cenário ainda sem execução reproduzível. Cada lacuna mantém o item **aberto** para homologação.

| # | Cenário | Situação e evidência / lacuna |
| --- | --- | --- |
| 1 | IP/proxy e headers forjados em filtros reais | **PASS no caminho MockMvc de filtros:** `AuditContextFilterFlowTest` atravessa `TrustedSchemeFilter` + `AuditContextFilter`; `ClientIpResolverTest` verifica CIDRs/spoof; pendente proxy reverso implantado no servidor real. |
| 2 | CORS, CSRF e cookies | **PARCIAL:** `HttpSecurityFlowTest` passa por Spring Security com CORS permitido/negado, bootstrap `XSRF-TOKEN` e rejeição/aceitação `X-XSRF-TOKEN`; falta ensaio cross-site com browser real e configuração TLS/proxy de deploy. |
| 3 | JWT, duas sessões, expiração, revogação e replay | **PARCIAL:** `JwtTokenProviderTest` e `SessaoAutenticacaoServiceTest` cobrem token/sessão; não foi executada jornada real de dois browsers autenticados, expiração e replay após logout em backend vivo. |
| 4 | ADMIN/OPERADOR, hierarquia e URLs diretas | **PARCIAL:** `CargosIntegrationTest`, `ConfiguracaoSistemaIntegrationTest`, `HttpSecurityFlowTest` e `RelatoriosIntegrationTest` exercitam roles e URLs diretas; Playwright real com ambas contas está pendente. |
| 5 | Commit, rollback, falha de auditoria e concorrência | **PARCIAL:** `AuditoriaNegocioServiceTest`, `LogSistemaServiceTest` validam contratos/falhas selecionadas; rollback e escrita simultânea em pedidos/estoque, usuário e configuração ainda sem evidência integral. |
| 6 | Antes/depois sem dados proibidos | **PARCIAL:** allowlist/sanitização em `LogSistemaServiceTest` e A04 para clientes/produtos/perfis; revisar todos os caminhos e casos de campos pessoais/segredos, especialmente serviços ainda não instrumentados. |
| 7 | Legado nulo e política temporal | **PARCIAL:** V9 mantém `event_id` nulo no legado e não reinterpreta `TIMESTAMP` histórico; ainda falta matriz com dados legados reais sanitizados, fusos e limiares de horário. |
| 8 | Migração em banco novo e cópia de esquema anterior | **PARCIAL:** migrations V1–V10 carregadas no PostgreSQL 16 novo; **BLOQUEADO** teste de upgrade de cópia sanitizada anterior. |
| 9 | Grants com role restrita | **PASS para ACL pós-migração:** `AuditRestrictedRoleIntegrationTest` habilita LOGIN temporário de `aguser` no container, concede somente `USAGE` de schema e `SELECT/INSERT` de log, conecta como `aguser` e verifica três recusas `42501`. Requer inspeção adicional de grants já existentes e ownership em ambientes legados. |
| 10 | Filtros/paginação/modal e acessibilidade responsiva | **PARCIAL:** Chromium 81 cenários, navegação e responsividade 320 px a ultrawide; majoritariamente APIs mockadas; sem homologação completa com API/contas reais e ferramentas assistivas. |
| 11 | Todos os relatórios, vazios, filtros, totais, POI e async | **PASS em integração Spring/PG16:** `RelatoriosIntegrationTest` percorre 39 relatórios, abre XLSX com POI, verifica filtros/vazios/totais e download assíncrono. Faltam testes de volumetria e navegador real. |
| 12 | Exportação de logs sem realimentação e falha/cancelamento | **PARCIAL:** corte anti-autoinclusão e estados gerados em `RelatoriosIntegrationTest`, falha/interrupção em `AdminRelatorioExportControllerTest`; cancelamento via browser/conexão real não comprovado. |
| 13 | Regressão clientes, produtos, pedidos, estoque, cargos, IA/fallback | **PARCIAL:** backend 142 testes, frontend 81 cenários, Python 2 testes; não há cobertura integrada completa do fluxo pedido–estoque–IA/fallback com banco e navegador reais. |

## Medição disponível e sua representatividade

- `RelatoriosIntegrationTest.todosOsRelatoriosDoCatalogoExportamComESemFiltrosPeloHttp`: **28,377 s** no Surefire, para percorrer as exportações de **39 relatórios** com filtros quando aplicáveis, em **um** teste integrado (inclui setup, serialização, async e leitura POI). A suíte da classe consumiu **49,657 s**. Fonte: XML Surefire de 24/10/2026.
- **Volume do fixture:** 2 clientes, 2 produtos, 2 estoques, 3 pedidos, 3 itens, 1 movimentação, 1 entrega, 1 evento legado de auditoria por configuração inicial da classe; as exportações geram eventos adicionais. Isto é **um cenário funcional pequeno, não volumetria representativa de produção**. O número de operações de exportação é >=39, não foi medido individualmente; não inferir latência p95 de requisição ou throughput a partir do tempo agregado.
- **Ensaio de busca de auditoria:** `AuditQueryPerformanceIntegrationTest` inseriu **10.000 logs sintéticos** de ação `V01_LOAD`, via SQL em uma transação revertida ao final. O serviço `LogSistemaService.pesquisar` filtrou a ação, ordenou por ID e paginou 50 linhas. Após 5 aquecimentos, 30 chamadas sequenciais tiveram **p50 25,729 ms**, **p95 28,536 ms**, máximo **31,601 ms**. JVM heap usado: **154,1 MiB antes** e **174,1 MiB depois** das consultas (sem limpeza forçada; delta não é consumo líquido atribuível à operação). 12 processadores lógicos, Ryzen 5 5500U. Esta medição cobre **consulta de serviço/JPA/Postgres em container local**, **não HTTP, concorrência, filtros complexos ou produção**. Veja linha `V01_PERF` em `target/v01-performance.log`.
- Na repetição **dentro da suíte de 147 testes**, o mesmo cenário registrou p50 **31,119 ms**, p95 **43,117 ms**, máximo **43,320 ms** e heap de 135,0 para 147,0 MiB; ver `target/v01-full-mvn-147.log`. A variação entre as duas execuções reforça que são medições laboratoriais pontuais, sem SLA ou caracterização de capacidade.
- **Consumo (amostra pontual):** durante execução Maven com Testcontainers no host, dois processos Java recentes mostraram working set de aproximadamente **173,7 MiB e 485,1 MiB**. Esta amostra combina processos de teste/execução e **não mede RAM máxima do serviço isolado**; não extrapolar para produção. CPU: 12 processadores lógicos visíveis, identificação AMD64 acima. RAM física desconhecida.
- **Lacuna não funcional impeditiva:** executar carga controlada no stack completo descartável com volume proporcional ao esperado (por exemplo, 10 mil logs de auditoria, 1 mil pedidos, 1 mil clientes, múltiplas sessões), registrar hardware completo/limites Docker, conexões concorrentes, p50/p95/p99 HTTP, RSS/heap e consumo Postgres, com repetição e limites de aceite definidos. Nenhuma alegação de escalabilidade é feita.

## Correções feitas durante a V01

1. `CargosIntegrationTest.java`: autenticação de teste passou a usar principal ADMIN persistido, compatível com nova trilha de auditoria.
2. `ConfiguracaoSistemaIntegrationTest.java`: operações mutantes válidas passaram a enviar token CSRF; teste negativo OPERADOR preservado.
3. `ClienteCrudCacheIntegrationTest.java`: contexto de segurança ADMIN real para auditoria e limpeza após execução.
4. `agerp-frontend/tests/e2e/api-proxy-auth.spec.ts`: mocks de login passaram a servir bootstrap `/api/auth/csrf` e validar header `X-XSRF-TOKEN`.
5. `security/AuditContextFilterFlowTest.java` (**novo**): três testes integrando filtros e origem confiável/não confiável.
6. `AuditRestrictedRoleIntegrationTest.java` (**novo**): role PostgreSQL com login restrito e negação de DML destrutivo; grants temporários são revertidos no `finally`, container descartável.
7. `AuditQueryPerformanceIntegrationTest.java` (**novo**): 10 mil registros sintéticos transacionais, métricas p50/p95 de paginação e heap; não altera dados persistentes.

Na primeira execução de backend com as mudanças A01–A06, **142 testes tiveram 4 falhas e 1 erro** relacionados a mocks antigos de autenticação/CSRF; os quatro ajustes corrigiram essas incompatibilidades de teste, sem remover asserções nem flexibilizar produção. Uma tentativa sem liberação de Docker gerou **37 erros** de Testcontainers por falta de acesso ao pipe; depois houve suítes integrais **142/142**, **146/146** e, por fim, **147/147 verdes** com Docker autorizado. Estes são eventos históricos, não falhas remanescentes da execução comprovada.

## Pendências manuais, aceitação e entrega

1. Finalizar cobertura A04 (pedidos/estoque, usuários, configuração, IA, leituras sensíveis) e executar testes transacionais de rollback/falha de escrita de log e corrida de updates.
2. Preparar snapshot **sanitizado** do esquema anterior em PostgreSQL 16 descartável; medir migrações, constraints, ownership, privileges e casos de legado/timestamps, incluindo permissões herdadas preexistentes. Nunca executar contra banco de produção.
3. Iniciar backend + proxy + frontend com usuários ADMIN/OPERADOR de teste e API real; rodar Playwright sem `page.route` para os cenários críticos de login, sessão dupla, replay, URLs diretas, relatórios e cancelamento de download; documentar resultados distintos dos cenários mockados.
4. Executar teste de carga com volume/hardware representativos e registrar latência, p95 e RSS conforme acima; observar advertência do bundle Vite de ~1,2 MB.
5. Revalidar se A07 entra de fato na release; se entrar, incluir casos de teste e matriz específica antes de liberar.

**Critério de liberação não alcançado:** faltam evidências substanciais dos itens 3, 5, 7, 8, 10, 12 e 13, além de teste não funcional representativo. Não promover a release com base apenas em suítes verdes. As mudanças estão **sem commit** para revisão do responsável.

### Comandos manuais de commit (não executados)

Revisar `git diff` antes de usar estes comandos. Seleção explícita evita incluir inadvertidamente as dezenas de modificações preexistentes:

```powershell
git add -- src/test/java/com/agerp/agerp/CargosIntegrationTest.java src/test/java/com/agerp/agerp/ConfiguracaoSistemaIntegrationTest.java src/test/java/com/agerp/agerp/ClienteCrudCacheIntegrationTest.java agerp-frontend/tests/e2e/api-proxy-auth.spec.ts src/test/java/com/agerp/agerp/security/AuditContextFilterFlowTest.java src/test/java/com/agerp/agerp/AuditRestrictedRoleIntegrationTest.java src/test/java/com/agerp/agerp/AuditQueryPerformanceIntegrationTest.java docs/validacao-v01-p1.md
git diff --cached --check
git diff --cached --stat
git commit -m "test(auditoria): validar V01 segurança, relatórios e regressões"
```

**Atenção:** os primeiros quatro arquivos de teste já tinham alterações da evolução A01–A06 antes da V01; `git add` desses caminhos adiciona o **arquivo inteiro**, não apenas o ajuste feito agora. Separar hunks com `git add -p` se for necessário registrar apenas a V01. Nenhum desses comandos foi executado nesta validação.

## Adendo 25/10/2026: V02 isolada não equivale a aceite V01

O diagnóstico original acima permanece como fotografia de 24/10. Na
preparação V02 de 25/10 houve backup e **restauração real** do banco anterior
(V1–V8), aplicação controlada de V9/V10 na cópia e nova suíte Maven com
**147/147 PASS**. A evolução não foi implantada no banco ou contêiner originais.
Detalhes, hashes, volumes, comandos e evidências: `docs/docker.md`.

| # | Estado atualizado da pendência | Classificação da lacuna |
| --- | --- | --- |
| 1 | Filtros reais em MockMvc PASS; proxy e TLS do acesso efetivo não homologados | Teste não executado / decisão operacional |
| 2 | Bootstrap CSRF no Nginx candidato **200**; POST sem CSRF **403** e com CSRF válido/credenciais inválidas **401**; Playwright **3/3 PASS sem mocks** nesse fluxo (Chromium/Firefox/WebKit), mas HTTPS cross-origin pendente | Cobertura parcial; decisão TLS pendente |
| 3 | Contratos unitários de JWT/sessões PASS; duas sessões reais, revogação e replay **não executados** | Teste bloqueado por credenciais descartáveis |
| 4 | Verificações backend ADMIN/OPERADOR PASS; navegação direta com ambos os usuários pelo proxy **não executada** | Teste bloqueado por credenciais descartáveis |
| 5 | Assertions pontuais PASS; rollback/concorrência dos demais fluxos A04 ainda sem cobertura | Testes não executados |
| 6 | Sanitização e allowlist pontuais PASS; auditoria antes/depois de todos os serviços não demonstrada | Testes não executados |
| 7 | V9 preservou **107** logs legados com `event_id NULL`; origem de fuso horário não decidida | Decisão de política temporal + testes pendentes |
| 8 | V9/V10 PASS em banco novo (V01) e agora em cópia **restaurada** de V8; cópia sanitizada abrangendo variantes legadas continua pendente | Parcialmente resolvido; teste não executado |
| 9 | Grants da role restrita PASS em Testcontainers e também na cópia migrada; permissões destrutivas negadas | PASS no escopo verificado |
| 10 | Navegação e acessibilidade mockadas PASS; browser real, modalidades assistivas e backend autenticado não homologados | Testes não executados |
| 11 | 39 relatórios + XLSX Apache POI PASS pelo Spring/Testcontainers; **download pelo Nginx autenticado não executado** | PASS backend, bloqueio E2E |
| 12 | Falha/cancelamento simulado PASS; desconexão/cancelamento real e anti-recursão sob navegador não homologados | Testes não executados |
| 13 | Regressões unitárias/integradas PASS no escopo anterior; pedido/estoque/IA/fallback real completo não ensaiado | Testes não executados |

**Defeitos comprovados/configuração:** a imagem antiga em execução responde
`GET /api/auth/csrf` com **403** inclusive sem sessão e sem token (mesmo
resultado no backend antigo isolado), enquanto a imagem candidata retorna
**200**. Não se trata da rejeição esperada de um POST sem token. O Compose
original também não repassava `AGERP_TRUSTED_PROXIES` e
`AGERP_CORS_ORIGINS`, embora a aplicação candidata as consuma; passagem
declarativa preparada sem recriação de contêiner. Nenhum defeito de código
novo foi comprovado no ensaio; não houve mudança de regra de segurança.

**Infraestrutura de testes:** wrapper Maven 3.6.3 indisponível offline,
acesso Docker sandbox inicialmente negado e bind de Nginx numa rede Docker
interna que não publicou a porta no host. Maven 3.9.9 offline com acesso ao
Docker funcionou; o Nginx de testes novo com ponte própria está acessível
**somente** no loopback `127.0.0.1:53988`. Os primeiros insucessos não são
falhas do backend. Uma tentativa de criação de identidades ADMIN/OPERADOR
sintéticas na cópia foi bloqueada pela ferramenta **antes** da execução;
nenhuma identidade foi adicionada por esse procedimento.

Um novo teste reproduzível `agerp-frontend/tests/e2e/v02-isolated-csrf.spec.ts`
usa a **API HTTP real** via Nginx isolado, sem `page.route` nem credenciais
reais: **3/3 PASS** nos três navegadores; ESLint desse arquivo PASS. Python
foi repetido com **2/2 PASS**, e frontend `node --test` com **4/4 PASS**.

**Decisões pendentes do responsável:** fornecer ou autorizar credenciais
descartáveis preexistentes para ADMIN/OPERADOR **somente na cópia**, confirmar
se A07 integra a release, política temporal de legado e fuso, uso do ambiente
por terceiros e janela de manutenção, HTTPS/Tailscale/proxy real, peers
confiáveis, origens exatas de CORS e obrigatoriedade do cookie `Secure`.
Sem essas decisões, login bem-sucedido, revogação, auditoria autenticada e
XLSX via Nginx **permanecem BLOQUEADOS**, não PASS.

**Parecer atualizado: V01 AINDA NÃO PRONTA, V02 SEM DEPLOY.** Nenhum commit
ou outra operação Git mutante foi executado na preparação.

## Adendo 25/10/2026 — homologação autenticada em ambiente isolado

**Este adendo substitui somente os estados de testes descritos como pendentes nos
adendos anteriores.** O registro de 24/10 e a preparação inicial de V02 acima
são históricos; não interpretar seus bloqueios antigos como se os testes reais
abaixo ainda não tivessem ocorrido. A V01 completa continua **NÃO APROVADA**.
O deploy nos serviços originais continua **NÃO AUTORIZADO**.

### Identidade do código, das imagens e do destino

- Branch local: `dev`; HEAD `944e01ec86cebfb881ba1f673c927b1c1aeb7e18`.
  Árvore extensamente modificada e não commitada: o HEAD **não identifica
  sozinho** a candidata. Os testes de backend abaixo exercem as fontes de
  trabalho atuais; o Playwright real exercita as **imagens candidatas
  construídas anteriormente**, identificadas pelos hashes abaixo. Não inferir
  que alterações posteriores ao build foram testadas dentro dessas imagens.
- PostgreSQL **isolado** `agerp-v02-pg-net-20261025-0025`, PostgreSQL 16,
  banco `agdb`, volume exclusivo `agerp-v02-netpg-data-20261025-0025`, rede
  interna `agerp-v02-isolated-net-20261025-0019`, **sem porta publicada**.
  Imagem `sha256:1a6ab3f5345eb6dbe04a1349529caabdb0ab09293a09590fad07b2246bfa4b54`.
- Backend candidato `agerp-v02-backend-20261025-0030`, imagem
  `sha256:a57d5dc4ba5dcdefb017e6b51c5f038c5e0dfee909294afdd670fac72c8c4b56`,
  JDBC `jdbc:postgresql://postgres:5432/agdb` validado no teste real.
- Frontend/Nginx isolado `agerp-v02-nginx-contrast-20261025`, imagem
  `sha256:279fd96d28531f2517ef67a591f91f24cfcdef5cf740787ce9af42fab9168d15`,
  exposição **somente** `127.0.0.1:53990 → 80`. A verificação anterior a
  toda escrita compara redes, portas, volumes, origem e JDBC com o serviço
  `agerp-postgres` original. Usuários ADMIN/OPERADOR foram criados com e-mails
  `example.invalid`, senhas aleatórias em memória, cadastro e BCrypt da
  aplicação, e aprovação estritamente por ID no **banco isolado**.
- A inspeção de 25/10 confirmou que o banco original continua no volume
  `tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026_pgdata`.
  As imagens originais observadas: backend `sha256:0f6719a7f7fe52add10a63a6fbff8b110a76e364341272a9ff2a779e28757043`,
  frontend `sha256:ec999ef29d32fc155e04a3070b62dd1fed42357d78cf65928534fbd105a2f952`.
  **Não houve atualização ou reinício dos originais.** Não criar identidades
  nesses serviços.

### Tabela de comandos, resultado e força da evidência

| Alcance | Comando / evidência reproduzível | Resultado e limite |
| --- | --- | --- |
| Maven integral anterior à inclusão do teste transacional | `mvn -o "-Dmaven.repo.local=C:/Users/filip/.m2/repository" test`; `target/v01-full-mvn-147.log` | **147/147 PASS** em Testcontainers PG16, versão da candidata da execução de 24/10; **não** recontado após a inclusão da nova classe de testes. |
| Rollback, falha injetada, falha **real** de INSERT de auditoria e concorrência (8 threads) | `mvn -o "-Dmaven.repo.local=C:/Users/filip/.m2/repository" "-Dtest=AuditTransactionConcurrencyIntegrationTest" test`; `target/surefire-reports/TEST-com.agerp.agerp.AuditTransactionConcurrencyIntegrationTest.xml` | **4/4 PASS, 0 falhas/erros, 24,381 s** no XML. O comando excedeu o limite da ferramenta (exit code `124` do invólucro); **exit code final Maven não observado**. Um teste força constraint SQL `CHECK ... NOT VALID` dentro de transação e comprova rollback também da DDL. Não significa cobertura de todos os fluxos A04. |
| Frontend unitário | `cd agerp-frontend; node --test tests/unit/httpError.test.mts` | **4/4 PASS** na execução anterior, sem inventar script `npm test`. |
| Build e lint atuais | `cd agerp-frontend; npm run build; npm run lint` (executados separadamente) | **PASS**, saídas com exit code 0; bundle Vite `index` ~1.202,75 kB, aviso >500 kB. As tentativas antigas que expiraram não contam como aprovação. |
| Navegador com API e banco **reais** via Nginx isolado | `cd agerp-frontend; $env:E2E_ISOLATED_BASE_URL='http://127.0.0.1:53990'; $env:E2E_BASE_URL=$env:E2E_ISOLATED_BASE_URL; npx playwright test tests/e2e/v02-isolated-authenticated.spec.ts --project=chromium --reporter=line` | **1/1 PASS, exit code 0**, reexecutado após ampliar a verificação anti-realimentação; sem `page.route`/mocks; `agerp-frontend/test-results/.last-run.json` indica `passed`. Inclui login, CSRF, sessões, RBAC, cliente/auditoria, telas reais, XLSX e carga pequena. **Apenas Chromium**, não três browsers autenticados. |
| Navegadores sem autenticação, backend real | `npx playwright test tests/e2e/v02-isolated-csrf.spec.ts` com `E2E_*` apontando para o Nginx de testes respectivo | **3/3 PASS** (Chromium, Firefox, WebKit); cobrem token CSRF e negação de login inválido, **não** substituem os testes autenticados. |
| Playwright funcional com mocks | `npm run test:e2e -- --project=chromium` | **81/81 PASS** em versão de 24/10; `page.route` e fixtures simulam APIs. Não somar como 81 testes de backend real. |
| Backend de relatórios | `RelatoriosIntegrationTest` no Maven/Testcontainers | **9/9 PASS**; 39 relatórios, filtros, vazios, XLSX reabertos pelo Apache POI, anti-realimentação, HTTP/async no teste Spring. |
| Falha/interrupção de download | `AdminRelatorioExportControllerTest` no Maven | **2/2 PASS** com simulação de exceção antes de headers e erro de escrita no stream; não prova cancelamento de conexão real. |
| Python | `cd services/python-ia; python -m unittest discover -s tests -v` | **2/2 PASS**; integração ponta a ponta da previsão/fallback ainda aberta. |

O teste autenticado contém verificações anteriores à primeira escrita. Para
repeti-lo, inspecionar seu código, preservar **exatamente** nomes de containers,
volume/rede/JDBC e URL loopback, e executar somente contra a instalação
isolada. O teste cria usuários e cliente sintéticos **na cópia**, e manipula
sessão sintética para simular expiração; não é um teste somente de leitura.
Credenciais, cookies, tokens e dados pessoais reais **não são logados**.

### Evidências detalhadas e lacunas restantes

| Item V01 | Situação em 25/10 após os novos testes | O que permanece fora da prova |
| --- | --- | --- |
| 1. IP/headers forjados | **PASS em MockMvc com filtros reais**, testes de proxy confiável e não confiável; Nginx isolado funcional | Topologia concreta de proxy/TLS em produção e peers confiáveis não identificados. |
| 2. CORS/CSRF/cookies | **PASS no escopo local**: bootstrap 200, falta de CSRF 403 esperado, token correto passa filtro; login real e cookie HttpOnly via proxy | Política `Secure`, domínio/origens reais, browser cross-origin sob TLS real não verificados. |
| 3. JWT/sessões/replay | **PASS no escopo isolado**: duas sessões ADMIN, logout de uma, replay do mesmo cookie 401, outra sessão 200, revogação ADMIN de OPERADOR, expiração de sessão isolada, bloqueio de usuário | Resistência sob cluster/múltiplas réplicas e HTTPS reais não aferida. |
| 4. RBAC/URLs | **PASS no escopo isolado**: ADMIN acessa logs/perfis, OPERADOR 403 em API administrativa, `/admin` no navegador não permanece aberto para OPERADOR | Hierarquia completa em cada rota não exaustivamente percorrida. |
| 5. Transações/concorrência | **PASS nos 4 casos focados**, inclusive falha física em INSERT no PostgreSQL descartável e 8 criações simultâneas de clientes, sem perda/duplicação de eventos | Pedido/estoque, usuários/configuração e concorrência de **updates** ainda carecem de ensaio transacional específico. |
| 6. Antes/depois/sigilo | Cliente real com ator/sessão/recurso/diferenças verificadas; assertions contra hash/senha/JWT em logs retornados | Amostra não comprova ausência de dados proibidos em todos os fluxos e falhas. |
| 7. Legado/tempo | **107** logs legados com `event_id NULL` preservados; novos eventos têm IDs; V9/V10 não alteram timestamps antigos | Fuso original desconhecido. Sem prova da interpretação histórica, **não converter**; só eventos de sessão V10 usam `TIMESTAMPTZ` explicitamente. Política de leitura/exibição legada necessita decisão. |
| 8. Migrations | **PASS** em PG16 novo e restauração real de banco V8, V9/V10 aplicadas somente em cópia; integridade e grants aferidos | Variantes legadas sanitizadas mais amplas, concorrência/locks de migração, rollback funcional da imagem antiga. |
| 9. Role restrita | **PASS**: `aguser` com LOGIN em DB descartável, SQLSTATE `42501` para operações proibidas, grants pós-V10 na cópia | Confrontar ACL/ownership de produção imediatamente antes do deploy. |
| 10. UI acessibilidade | **PASS no escopo real**: logs, pesquisa, modal e axe WCAG 2A/AA nos viewports **390 e 1280 px**; sem overflow horizontal | Leitores de tela reais, teclado/casos alternativos e browsers autenticados adicionais pendentes. |
| 11. Relatórios | **PASS funcional** no backend (39 IDs/Apache POI) e **4 XLSX reais** pelo Nginx (com dados, sem dados, filtrado e histórico de exportações), abertos e linhas verificadas com SheetJS | Nem todos os 39 foram baixados via Nginx; volume de exportação grande não medido. O leitor SheetJS emitiu avisos `Bad uncompressed size` apesar da abertura/assertions passarem; verificar interoperabilidade ZIP adicional antes de concluir compatibilidade irrestrita. |
| 12. Exportação de auditoria | **PASS anti-recursão pelo Nginx real**: planilha do histórico de exportações não contém ID do evento que a gerou; após concluir, duas linhas `SOLICITADA` e `GERADA` desse ID são verificadas no PostgreSQL isolado. Falha antes de headers e stream interrompido **PASS somente em simulação**. | Cancelamento efetivo de conexão/download pelo navegador e reconciliação de estados de entrega ainda não comprovados. `TRANSMISSAO_ENCERRADA` significa apenas escrita/flush observado no servidor, não recebimento confirmado no cliente. |
| 13. Regressão negócio/IA | Maven 147 anterior + 4 focados, frontend `.mts` 4, Playwright com mocks 81, Python 2; cliente e auditoria ponta a ponta real | Falta jornada completa **pedido → estoque → previsão IA/fallback** e cobertura de regressão com backend navegador real para demais recursos. |

**Carga HTTP limitada e observada somente no Nginx isolado:** 100 GETs
`/api/admin/logs?page=0&size=20`, concorrência 5, duração **670,46 ms**,
p50 **30,96 ms**, p95 **44,62 ms**, p99 **51,62 ms**, erros **0** (ensaio
mais recente; duas amostras anteriores deram p95 de 41,57 e 59,78 ms).
Hardware host AMD Ryzen 5 5500U, 12 lógicos;
Docker Desktop com memória máxima observada de **7,436 GiB**. Amostra
pontual de `docker stats` **ociosa**, não durante o pico: PG **74,41 MiB**,
backend **499,8 MiB**, Nginx **11,33 MiB**. Essas amostras não representam
uso de RAM durante carga, nem a escala esperada de produção. Não afirmar
"escalável" ou SLA de produção.

**Restrições operacionais:** backup/restore e V9/V10 isoladas previamente
comprovadas (detalhes em `docs/docker.md`), mantidos; nenhuma migration,
identidade de teste ou reinício no banco/serviços originais. Nenhuma operação
mutante de Git. Não completar a V01 apenas com os testes acima: permanecem
coberturas técnicas A04/pedidos/estoque/IA, cancelamento HTTP, variantes
temporais e compatibilidade de rollback, além das decisões operacionais.

**Decisões necessárias do responsável:** confirmar uso por terceiros e janela
autorizada; endereço real e terminador HTTPS/proxies confiáveis; origens CORS
exatas; perfil `dev`/`prod` e política `JWT_COOKIE_SECURE` conforme acesso;
inclusão A07 (não identificada como funcionalidade documentada da candidata);
proveniência e política temporal dos logs legados. Recomendação condicional:
se a autenticação usa HTTPS na borda, preservar cookie `Secure` nesse acesso,
com configuração explícita e validada de terminação TLS, sem tornar os peers
confiáveis indiscriminadamente.

**Parecer separado:** candidata **parcialmente validada em homologação**,
com os ensaios aprovados indicados e lacunas técnicas ainda abertas;
**deploy real NÃO AUTORIZADO e NÃO PRONTO**. Não executar `docker compose up`,
Flyway no original ou restauração operacional até autorização explícita.

## Adendo final de homologação isolada — 25/10/2026, ~02:24 BRT

Este registro substitui os números de testes **focados** dos adendos anteriores;
não converte testes bloqueados ou simulações em testes ponta a ponta aprovados.
O deploy real segue **não autorizado**, e a V01 permanece **parcial**.

**Identidade:** branch `dev`, HEAD `944e01ec86cebfb881ba1f673c927b1c1aeb7e18`,
árvore local com alterações e arquivos não rastreados. Impressão SHA-256 do
manifesto de 248 arquivos do escopo `src/main`, `src/test`, `agerp-frontend/src`,
`agerp-frontend/tests`, `nginx.conf`, `docker-compose.yml`, `pom.xml`, ordenados por
caminho e representados por `caminho<TAB>SHA256` em linhas unidas por LF:
`59165FEE098B1628FF65479B3EC046E7E6E6EA2F4AB14C2BBF6030C5A2677FE3`.
Fingerprint do teste Playwright desta execução:
`C3626C3BBCEF46A2D6D1C2E21D87C988CC8644F72BDBC1009356FA07E619BBAB`.
As imagens isoladas permanecem backend
`sha256:a57d5dc4ba5dcdefb017e6b51c5f038c5e0dfee909294afdd670fac72c8c4b56`,
Nginx `sha256:279fd96d28531f2517ef67a591f91f24cfcdef5cf740787ce9af42fab9168d15`
e PostgreSQL 16 `sha256:1a6ab3f5345eb6dbe04a1349529caabdb0ab09293a09590fad07b2246bfa4b54`.
**Atenção:** o fingerprint do worktree não é prova de que cada arquivo foi
incorporado às imagens construídas anteriormente; qualquer alteração posterior
ao build da imagem exige nova imagem candidata e regressão direcionada.

| Teste/comando | Resultado efetivamente observado | Evidência e limite |
| --- | --- | --- |
| `mvn -o "-Dmaven.repo.local=C:/Users/filip/.m2/repository" "-Dtest=AuditTransactionConcurrencyIntegrationTest" test` | **4/4 PASS; BUILD SUCCESS** em PG16 Testcontainers descartável | `C:/tmp/agerp-a04-constraint-validation.stdout.log`, `target/surefire-reports/TEST-com.agerp.agerp.AuditTransactionConcurrencyIntegrationTest.xml`, concluído 02:11:42. Rollback explícito, falha de escritor, erro real SQLSTATE `23514` no INSERT de auditoria e oito inserts concorrentes. Não substitui teste de updates concorrentes em pedidos/estoque. |
| `E2E_ISOLATED_BASE_URL=http://127.0.0.1:53990; E2E_BASE_URL=...; npx playwright test tests/e2e/v02-isolated-authenticated.spec.ts --project=chromium --reporter=line` | **1/1 PASS**, 15,3 s, sem mocks HTTP | `C:/tmp/agerp-v02-stats-validation.stdout.log`, `agerp-frontend/test-results/.last-run.json`. Confere rede interna, volumes exclusivos, JDBC e porta antes da primeira escrita. Autenticação/sessões/RBAC, UI axe 390/1280, cliente/produto/auditoria, pedido → confirmação → estoque 7→5 → cancelamento → 7, duas movimentações, previsão `ESTIMATIVA_HEURISTICA`. Fallback real; predição ML online **não** exercitada. |
| Quatro downloads XLSX reais pelo Nginx, abertos com SheetJS, diretório central e data descriptors inspecionados | **PASS** nos 4 arquivos (dados, vazio, filtro, histórico de exportações); 11 entradas e **11 descritores ZIP64** por XLSX, 44 descritores coerentes | O aviso persistente `Bad uncompressed size` vem do leitor `xlsx` 0.18.5 ao interpretar descritores ZIP64, mas o teste checa integralmente tamanhos de 64 bits e conteúdo. A suite de backend abre 39 relatórios com Apache POI. Não declarar interoperabilidade universal sem leitores externos adicionais. |
| `cd agerp-frontend; npm run lint`; `node node_modules/typescript/bin/tsc -b`; `node node_modules/vite/bin/vite.js build` | **PASS**: lint código 0, tsc código 0, Vite `built in 3.81s`; wrapper `npm run build` expirou após iniciar Vite, portanto **não** usar esse timeout como resultado do build | `C:/tmp/agerp-v02-vite-escalated.stdout.log`. Saída contém aviso não fatal de bundle JS de 1.202,75 kB, acima de 500 kB. |
| Carga HTTP autenticada no Nginx isolado, GET `/api/admin/logs?page=0&size=20`, **600** requisições, concorrência **5** | **600 HTTP 200**, **0 erros**, duração **4.694,78 ms**, p50 **27,53 ms**, p95 **45,57 ms**, p99 **61,14 ms** | `C:/tmp/agerp-v02-stats-validation.stdout.log`, Ryzen 5 5500U (12 CPUs lógicas), Docker com limite de 7,436 GiB. Apenas leitura e escala pequena; não extrapolar para produção. |

O `docker stats --no-stream` foi colhido **durante** a carga em duas amostras:
PostgreSQL 83,16 / 83,41 MiB e CPU 73,30% / 33,31%; backend 520,6 / 521 MiB
e CPU 384,34% / 183,74%; Nginx 13,89 / 13,59 MiB e CPU 26,04% / 11,23%.
São amostras, **não picos garantidos**. O limite comum observado era 7,436 GiB.

**Passos ainda não comprovados:** A04 está **implementada parcialmente** para
cliente/endereço/produto/perfil; faltam eventos correlacionados em pedidos/itens/
estoque, usuário/configuração, IA e leituras sensíveis, com rollback e locking
de updates concorrentes. Faltam cancelamento real da conexão de download,
integração ML em serviço Python online, variantes legadas mais amplas e teste
de compatibilidade da imagem antiga com V10; a topologia TLS/IP/CORS real não
foi fornecida. As regras locais `AGERP_TRUSTED_PROXIES` e `AGERP_CORS_ORIGINS`
são consumidas no backend e ensaiadas por testes de filtro/configuração, mas
isso não valida IPs, origens, peers ou cabeçalhos do proxy da implantação.

**Tempo e legado:** 107 logs restaurados com `event_id NULL` permanecem; os
testes adicionaram eventos **sintéticos novos** somente em `agdb` isolado.
Eventos novos de auditoria usam o timestamp da aplicação/coluna existente;
os eventos de sessão da V10 têm `TIMESTAMPTZ`. A exibição deve respeitar o
contrato de UI e fuso configurado; a procedência dos timestamps históricos
é desconhecida. Não há evidência para convertê-los ou afirmar seu fuso; é
necessária decisão explícita sobre interpretação/exibição dos históricos.

**Decisões humanas:** terceiros/janela, URL real e caminho HTTPS/TLS e proxies
exatos, origens CORS, perfil e `JWT_COOKIE_SECURE` na topologia final, inclusão
ou exclusão da A07 e política dos timestamps históricos. **Parecer:** candidata
**parcialmente validada em homologação**; **deploy real NÃO autorizado e NÃO pronto**.
# Atualização vigente — V01/A04 candidata isolada, 25/10/2026 ~04:45 BRT

**Este bloco prevalece sobre o estado dos adendos históricos abaixo**, que relatam passos anteriores da mesma homologação e contêm lacunas já resolvidas. A V01 **não recebeu aceite integral**. Os quatro contêineres originais não foram atualizados/reiniciados; a V02 **não foi implantada**.

## Identidade e validade da candidata

- Branch `dev`; commit-base `944e01ec86cebfb881ba1f673c927b1c1aeb7e18`. `git status --short` e `git diff --stat` foram lidos em 25/10: dezenas de modificações locais e arquivos novos **não commitados** nas fontes de autenticação, auditoria, estoque/pedidos, migrações V9/V10, frontend/testes e documentação. O HEAD sozinho **não identifica** a candidata. Nenhuma alteração local preexistente foi descartada.
- Manifesto SHA-256 **vigente**: `baa33dbdc3d7e360d6973f3785a460694793000a999fe8d7b99a8c1cf27a8353`, **256 arquivos** (`src/main`, `src/test`, `agerp-frontend/src`, `agerp-frontend/tests`, `services/python-ia/tests`, `nginx.conf`, `docker-compose.yml`, `pom.xml`, Dockerfile Python e `playwright.config.ts`): caminho relativo normalizado com `/`, `<TAB>`, SHA-256 minúsculo por arquivo, ordenação por caminho absoluto, linhas LF e SHA-256 do conjunto UTF-8. O manifesto **anterior**, sem `UsuarioPerfilAuditoriaConcorrenciaIntegrationTest.java`, era `fef31b140354f9ec2bed85037b20258e00e7122b51acd0202d89d8792b79be0a` (255 arquivos); o recálculo excluindo apenas esse teste reproduziu exatamente esse hash. Os manifestos identificam código/configuração/testes locais e **não documentos**, nem implicam que imagens existentes contenham testes adicionados posteriormente.
- Teste novo `ConfiguracaoAuditoriaConcorrenciaIntegrationTest.java` SHA-256 `C1882394B10A1F0850A97C7D04F7C1343DCB9CA0C9E8E0AD09FE325C78D78166`; spec de autenticação Playwright SHA-256 `F9503D11631840AF03983D6F23874F71A0BF0F2682CE8DBD119BBD733E741B91`.
- Candidata funcional (sem rebuild após a adição **somente de testes/documentação**): backend isolado `agerp-v01-backend-corrected-20261025`, imagem `sha256:b1830915ab57e3892eb8128091b899be3363f5055655d8a44a33e17ded8f543f`; Nginx `agerp-v01-nginx-corrected-20261025`, imagem `sha256:78ef91e1f27b3cede6bc8fa37ba43a6aeb756b8da74b36652ffbf0e64f90e328`, URL **somente loopback** `http://127.0.0.1:53992`; Python real `agerp-v01-python-20261025`, imagem `e6ddcc88671d` (ID abreviado). PostgreSQL 16 `agerp-v02-pg-net-20261025-0025`, volume exclusivo `agerp-v02-netpg-data-20261025-0025`, sem porta do banco publicada; rede de validação `agerp-v01-validation-net-20261025`. Imagens **não contêm automaticamente testes alterados depois do build**.
- Originais preservados: `agerp-postgres` e volume `tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026_pgdata`; `agerp-app` imagem `sha256:0f6719a7f7fe52add10a63a6fbff8b110a76e364341272a9ff2a779e28757043`; `agerp-python`; `agerp-frontend`. Não houve migrations, contas artificiais ou reinícios no original.

## Comandos e resultados — evidência nova que prevalece

| Teste e comando | Resultado comprovado | Evidência/limitação |
| --- | --- | --- |
| `mvn -o '-Dmaven.repo.local=C:/Users/filip/.m2/repository' test` | **156 testes, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS**, 25/10 04:08:54 | `C:/tmp/agerp-v01-full-suite-0407.stdout.log` e 40 `target/surefire-reports/TEST-*.xml`. Inclui Testcontainers PG16, A04 rollback, pedidos/estoque concorrentes, fallback IA. **Anterior** à criação dos testes de concorrência de configuração e de usuário/perfil. Maven wrapper 3.6.3 não executável offline; usado Maven 3.9.9 instalado. |
| `mvn -o '-Dmaven.repo.local=C:/Users/filip/.m2/repository' '-Dtest=ConfiguracaoAuditoriaConcorrenciaIntegrationTest' test` | **1/1 PASS no XML Surefire atual**, PostgreSQL 16/Testcontainers: dois updates sobre mesma versão, um commit/um evento, restauração do valor após teste | `target/surefire-reports/TEST-com.agerp.agerp.ConfiguracaoAuditoriaConcorrenciaIntegrationTest.xml`, duração **29,052 s**. Primeira tentativa falhou por `LazyInitializationException`, corrigida no **código do teste**; outra tentativa falhou na infraestrutura do sandbox sem acesso ao Docker; última invocação com permissão de teste encontrou **0 errors/failures no XML**, mas o invólucro da ferramenta finalizou por **timeout 34 s, exit code 124**. **Exit code Maven não observado**: aprovação apenas do caso via Surefire; suíte integral de 157 **não reexecutada**. |
| `mvn -o '-Dmaven.repo.local=C:/Users/filip/.m2/repository' '-Dtest=UsuarioPerfilAuditoriaConcorrenciaIntegrationTest' test` | **2/2 PASS no XML Surefire**, PostgreSQL 16/Testcontainers; concorrência real de aprovação/edição do mesmo usuário (dois commits, dois eventos sem nome/e-mail) e dois admins disputando edição do mesmo perfil (`@Version`: um commit e um único evento) | `target/surefire-reports/TEST-com.agerp.agerp.UsuarioPerfilAuditoriaConcorrenciaIntegrationTest.xml` e `.txt`, duração **24,42 s**. Primeira execução revelou uma consulta incorreta no **teste** (`entidade`), corrigida para `USUARIO`; reexecução **0 falhas/erros no XML**, porém o invólucro também excedeu seu timeout (`124`). Não houve observação de **BUILD SUCCESS** dessa invocação nem reexecução integral com esses dois novos testes. |
| `mvn -o '-Dmaven.repo.local=C:/Users/filip/.m2/repository' '-Dtest=AuditTransactionConcurrencyIntegrationTest' test` | **4/4 PASS, BUILD SUCCESS** | `C:/tmp/agerp-a04-constraint-validation.stdout.log`; rollback explícito, falha injetada de escrita, falha SQL real de auditoria e oito clientes concorrentes. |
| `PedidoAuditoriaConcorrenciaIntegrationTest` na suíte Maven | **2/2 PASS**, PG16 real | `target/surefire-reports/TEST-com.agerp.agerp.PedidoAuditoriaConcorrenciaIntegrationTest.xml`: confirmação duplicada idempotente; dois pedidos disputando estoque, exatamente uma baixa/evento. |
| `cd agerp-frontend; node --test tests/unit/httpError.test.mts`; `npm run lint`; `npm run build` | **4/4 PASS**, lint PASS, TypeScript/Vite build PASS | Executados com configuração real do `package.json` (não existe script `npm test`). Aviso Vite bundle ~1.202,75 kB, não falha. |
| `cd services/python-ia; python -m unittest discover -s tests -v` | **2/2 PASS** | Testes Python locais. |
| `npx playwright test tests/e2e/v02-isolated-authenticated.spec.ts tests/e2e/v02-isolated-csrf.spec.ts --project=<chromium\|firefox\|webkit>` com `E2E_BASE_URL` e `E2E_ISOLATED_BASE_URL` na porta `53992` | **2/2 PASS por navegador, 6/6 no total**, autenticação/back-end/Python/PG reais, **sem mocks de HTTP**, validação de isolamento antes de qualquer escrita | `agerp-frontend/tests/e2e/v02-isolated-*.spec.ts`, resultados da homologação anterior desta mesma imagem. Login, token/CSRF/cookies, duas sessões, revogação, replay, expiração, ADMIN/OPERADOR, cliente/produto, pedido 7→5→7, auditoria, modal/filtros/axe 390/1280. O conjunto de **81/81 Playwright com mocks** de execução anterior é evidência separada e não prova API real. |
| HTTP cliente encerra socket de XLSX **via Nginx**, antes de ler body | **Socket fechado realmente pelo cliente**; estados `EXPORTACAO_SOLICITADA`, `EXPORTACAO_GERADA`, `EXPORTACAO_TRANSMISSAO_ENCERRADA` observados | Nginx pode efetuar buffering; **não prova** exceção de escrita percebida no backend, limpeza de temporários sob streaming lento ou recebimento integral pelo cliente. `TRANSMISSAO_ENCERRADA` é estado do servidor, **não comprovante de entrega**. |
| Relatórios HTTP reais via Nginx + `RelatoriosIntegrationTest` | **4 XLSX** abertos e conferidos pelo proxy; backend validou **39 tipos** reabrindo por Apache POI, incluindo dados vazios/filtros/totais | Teste de browser usa SheetJS e verifica ZIP64; advertência `Bad uncompressed size` do leitor 0.18.5 foi investigada com descritores ZIP64 coerentes, **sem alegar interoperabilidade universal**. Histórico de exportações não inclui sua própria operação recém-solicitada (anti-realimentação). |
| Python real online e falhas | **Online: status `SUCESSO`** pela API real. `IaPrevisaoFallbackTest` **3/3 PASS**: falha HTTP loopback, timeout e falha de auditoria na transação | Offline/timeout isolados por servidor HTTP local Java + mocks de repositório; **não** indisponibilidade end-to-end desligando contêiner Python. Heurística em outro E2E é evidência de fallback, não de ML online. |
| 600 GETs autenticados `/api/admin/logs` via Nginx, concorrência 5 | 600 HTTP 200, 0 erros; amostras p95 ~31–40 ms, total ~4,67–4,70 s | Hardware Ryzen 5 5500U, 12 lógicos; Docker limite 7,436 GiB, backend ~485–489 MiB, PostgreSQL ~98–99 MiB, Nginx ~13–14 MiB, durante amostras. **Não** comprova escalabilidade/SLA de produção. |

## Mapa obrigatório de V01 — leitura do estado atual

| Exigência | Evidência positiva | Pendência real |
| --- | --- | --- |
| 1 IP/proxy/headers falsos | Testes de filtros efetivos/MockMvc, configuração de trusted proxies; Nginx isolado | Topologia e IPs reais de proxies/TLS indefinidos. |
| 2 CORS/CSRF/cookies | Token obtido e POST sem token rejeitado com 403 esperado; POST legítimo e login com cookie funcional | Perfil HTTPS/CORS/Secure real depende de configuração aprovada. |
| 3 JWT/duas sessões/expiração/revogação/replay | Playwright real 3 navegadores | Cluster e TLS externos não ensaiados. |
| 4 ADMIN/OPERADOR/hierarquia/URL direta | E2E real + testes de autorização | Cobertura de todas as rotas/ações não exaustiva. |
| 5 commit/rollback/falha real/concor­rência | AuditTransactionConcurrency 4, PedidoAuditoriaConcorrencia 2, ConfiguracaoAuditoriaConcorrencia 1 (XML) e UsuarioPerfilAuditoriaConcorrencia 2 (XML) | Casos restantes: último ADMIN sob concorrência, outras combinações transacionais e concorrência/distribuição entre réplicas; a suíte integral após os testes novos ainda não foi reexecutada. |
| 6 antes/depois/sigilo | `changes_json` com chaves aprovadas; verificação de logs de pedido, configuração e usuário nos testes | Auditoria negativa/sigilo não exaustiva em todos os caminhos de erro. |
| 7 legado/tempo | 107 eventos anteriores com `event_id NULL` preservados na cópia V10 | Proveniência/fuso legado indecididos; **não houve conversão histórica**. |
| 8 migrations/banco novo e restauração | Flyway PG16 novo e V8 restaurado → V9/V10 isolado, esquema íntegro | Variantes adicionais de esquema e locks reais em produção não ensaiados. |
| 9 grants restritos | `aguser` com SELECT/INSERT e negativas UPDATE/DELETE/TRUNCATE no PG16 isolado | Rever ownership/ACL reais na janela futura. |
| 10 UI/filtros/paginação/modal/responsivo | E2E + axe 390/1280 em Chromium/Firefox/WebKit | Leitores de tela reais e casos adicionais de teclado. |
| 11 relatórios/vazios/filtros/totais/POI/XLSX async | 39 relatórios POI e 4 XLSX Nginx autenticados; async/falha em teste Spring | Download muito grande e interoperabilidade externa não universal. |
| 12 exportação/cancelamento/anti-realimentação | Exportação não se auto-inclui; evento servidor e socket real encerrado no cliente | Efeito no backend sob desconexão enquanto gera/streama; arquivos/conexões temporárias. |
| 13 regressão clientes/produtos/pedidos/estoque/cargos/IA | Maven 156, Python 2, frontend 4, Playwright real 6, Python online | Outage de contêiner Python no E2E, variantes e concorrência de atualização de outros cadastros. |

### Compatibilidade antiga com V10: **bloqueio, não aprovação**

Foi criada **cópia adicional, inteiramente separada**, do PostgreSQL V10 já isolado: rede `agerp-v01-oldcompat-net-20261025`, volume `agerp-v01-oldcompat-pgdata-20261025`, contêiner PostgreSQL 16 `agerp-v01-oldcompat-pg-20261025`, sem porta pública. Dump lógico `C:/tmp/agerp-v01-oldcompat-copy-20261025-0416/v10-copy.dump`, **126.189 bytes**, SHA-256 `1E30F4C4B226AF9E181BE60044595CA56CBEAC5B3FED378A85E478724BC234EE`; globals reservados `globals.sql`, **1.044 bytes**, SHA-256 `8F23C952A9DA180C77AD96D5318198320627D5640032E7340B427981ECAA9CA8`. **Não imprimir ou distribuir** globals: podem conter hashes. Restauração confirmou 17 tabelas, Flyway V10, 649 logs, 107 eventos legados com `event_id NULL`, 0 FKs não validadas, papel técnico SELECT/INSERT autorizado e UPDATE/DELETE/TRUNCATE negados. Cópia/backup/volume **preservados**.

A tentativa de iniciar **uma nova instância separada** da imagem antiga `sha256:0f6719a7f7fe52add10a63a6fbff8b110a76e364341272a9ff2a779e28757043` apontada **exclusivamente** à cópia V10 teve recusa **explícita da ferramenta**: `Esta ferramenta foi bloqueada pelas configurações de segurança da OpenAI`. **Nenhum comando executado nessa tentativa**, nenhuma contornação. Por isso login, escrita, auditoria e relatórios **da imagem antiga sobre essa cópia V10 não foram ensaiados**. Startup antigo em outro banco isolado não prova compatibilidade. **Rollback apenas da imagem permanece não validado**; não presumir que rollback de imagem reverta Flyway.

**HTTP 403 observado anteriormente:** no backend/imagem antiga, `GET /api/auth/csrf` retornou 403 no fluxo de comparação; no candidato isolado `GET /api/auth/csrf` retornou 200 e forneceu token. O teste de POST protegido **sem CSRF** devolveu 403 **esperado**; POST protegido **com token** passou nos testes candidatos. A diferença antiga/candidata não prova, por si só, a causa precisa do 403 antigo (sessão/filtros/proxy/origem precisam de contexto de execução reproduzível). Não houve desativação de CSRF.

## Pendências técnicas e decisões humanas

**Técnicas ainda não aprovadas:** (a) duas corridas de usuários/perfis foram comprovadas (2/2 no XML), mas persistem concorrência da regra de **último ADMIN** e outras variantes da A04, além de nova suíte Maven integral; (b) cliente cancelar XLSX **durante** geração/stream lento, com prova de liberação de recursos, sem confundir `TRANSMISSAO_ENCERRADA` com entrega; (c) Python contêiner realmente indisponível/timeout ponta a ponta (sem desligar serviços originais); (d) execução funcional da imagem antiga contra o V10 **da cópia adicional**, dependente da liberação explícita de ferramenta, **sem contorno**; (e) carga XLSX maior, leitores externos e variantes do esquema legado. As falhas iniciais de testes (lazy entity e coluna `entidade`) foram **corrigidas exclusivamente em testes**. Houve também ausência de acesso Docker no sandbox (**infraestrutura**). Os XMLs focados mostram 1/1 e 2/2 sem erros, mas as invocações Maven associadas expiraram no invólucro; não apresentar o timeout como sucesso de execução integral.

**Decisões humanas únicas ainda necessárias** (nenhuma suprida por ausência momentânea de conexões):

1. Confirmar usuários/terceiros afetados e janela de manutenção, interrupção aceitável e responsável pelo rollback (**autoriza ou não uma janela futura**; ainda assim é necessária autorização explícita posterior para deploy).
2. Informar URL final, HTTP/HTTPS, terminação TLS, uso de Tailscale e **IPs exatos dos proxies confiáveis** (define `AGERP_TRUSTED_PROXIES` e encaminhamento de headers sem confiar em CIDRs indiscriminados).
3. Informar **origens CORS exatas** (define `AGERP_CORS_ORIGINS` sem `*` com credenciais).
4. Confirmar perfil `dev`/`prod` e política `JWT_COOKIE_SECURE` no caminho **real** de acesso (não relaxar cookies em produção).
5. Definir interpretação/fuso de `timestamp without time zone` dos logs anteriores (não modificar histórico sem decisão).
6. Definir inclusão ou exclusão explícita da A07 na release (não ampliar este escopo por suposição).

**Três pareceres distintos:** **A04 — implementação substancial, mas parcialmente comprovada**, com pedidos/estoque, usuários/perfis/configurações, IA e rollback realmente instrumentados, porém cobertura faltante nos casos acima. **Homologação da candidata — parcial**, testes 156 da suíte Maven integral **anterior** + 1 de configuração e 2 de usuário/perfil aprovados somente nos XMLs Surefire posteriores, bem como E2E reais nos limites registrados; há bloqueios e verificações ainda inconclusivas. **Prontidão para deploy real — NÃO PRONTA e NÃO AUTORIZADA**; V02 sem deploy. Nenhuma instrução deste documento autoriza atualizar os quatro contêineres originais.
