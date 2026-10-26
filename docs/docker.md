# Docker

Para a configuracao por variaveis, politica de cookies/CORS e roteiro de
recriacao de servicos, consulte [Configuracao por ambiente](configuracao-ambientes.md).

## Encerramento das pendências técnicas — 25/10/2026 (~16h BRT)

Esta é a referência de estado **mais recente** do deploy de **testes**; descrições
cronológicas e hashes antigos abaixo documentam execuções anteriores, não o estado
atual. Não houve homologação de produção nem alteração das migrations V9/V10.

| Pendência | Resultado | Correção (se necessária) | Evidência reproduzível |
| --- | --- | --- | --- |
| Exit Maven / Surefire contemporâneo | **Aprovado:** exit real `0`, **207 testes / 45 suites XML**, zero falhas, erros ou ignorados; XML de 15:44–15:45 | Corrida de impressão de headers no `MockMvc` corrigida desabilitando apenas o print no teste `RelatoriosIntegrationTest`; sem ocultar falhas HTTP | `target/agerp-full-verified.exit`, `target/agerp-full-verified.log`, `target/surefire-reports/TEST-*.xml`; `mvn -q -Dmaven.repo.local=C:/Users/filip/.m2/repository test` |
| Download longo via Nginx | **Aprovado para os três comportamentos observados:** cliente lento recebe integralmente 14.938.537 bytes em 27.825 ms; aborta aos 543.123 bytes em 6.063 ms com `EXPORTACAO_FALHA`; cliente pausa leitura 75 s e observa quebra antes do fim após 80.952 ms / 5.650.059 bytes com `EXPORTACAO_FALHA`. Um terminal por ID e nenhum XLSX remanescente. Não se provou qual timer interno provocou a desconexão da leitura parada. | `ExportacaoFluxo` mantém vaga/spool até saída do callback, captura terminal real; Nginx `proxy_buffering off`. O teste passou a conferir `/tmp/agerp-xlsx-spool`, não o padrão temporário antigo. | `agerp-frontend/tests/e2e/v02-long-stream.spec.ts`; `target/agerp-long-stream.log` + `.exit=0`; 60.000 logs sintéticos gerados e **60.000 removidos** por ID exclusivo, consulta final `0`; backend `509,7→562,4 MiB`, PostgreSQL `80,96→145 MiB` (amostras, não picos). |
| Morte abrupta e recuperação | **Aprovado** em JVM filha descartável finalizada por `destroyForcibly()`; lock de SO liberado, exclusivamente XLSX órfão próprio recuperado, ativo e desconhecido preservados. Recursos Docker isolados sem resíduos. | Spool privativo por execução/lock e recuperação idempotente; Compose de prova com labels de propriedade e diário para recuperação pós-interrupção. | `ExportacaoTemporariosTest.killRealDeProcessoIsoladoLiberaLockEPermiteRecuperacao`, `scripts/docker/invoke-isolated-probe.ps1` e quatro diários com `State=cleaned` em `scripts/docker/.isolation-runs/`. |
| Executor saturado / timeout | **Rejeição aprovada em integração Spring MVC:** HTTP 503 JSON e nova exportação HTTP 200 após liberação. Timeout/corrida de callback **aprovados em teste de ciclo de vida**, **não** demonstrados como timeout real do executor em socket HTTP. | Executor MVC limitado (2 core, 4 max, fila 8, `AbortPolicy`), verificação antecipada, auditoria e listener assíncrono; estado terminal único. | `ExportacaoAsyncHttpIntegrationTest` e `ExportacaoAsyncLifecycleTest` na suíte Maven; HTTP de teste Spring em vez de afirmar saturação do deploy real. |
| 1.048.576+ linhas de dados / múltiplas abas | **Não comprovado no limite real.** Código reserva cabeçalho e começa `Dados 2` após 1.048.575 registros na primeira aba. | Sem correção arbitrária. Evitado ensaio de milhões de células em computador compartilhado. Leitor PowerShell/ZIP corrigido e exercitado com fixture de limite reduzido: dois blocos, 3 IDs conferidos; divergência de ID rejeitada. Isso **não** substitui teste real. | `RelatorioAdminService.exportarComContagem`, `scripts/docker/validate-xlsx-row-limit.ps1` e receita na seção *Limite real de abas* de `docs/relatorios.md`. |
| Leitor de telas e produção | WCAG automatizado axe A/AA em 390/1280 px, Chromium aprovado; **leitor de telas manual pendente**. HTTPS/domínio/proxies/políticas de produção são decisões externas, não bloqueiam **testes**. | Roteiro manual em `docs/relatorios.md`; não houve instalação/alteração de leitor de telas, nem suposta homologação de produção. | `target/agerp-chromium-final.log`, `agerp-frontend/tests/e2e/v02-deployed-authenticated.spec.ts`. |
| Deploy seletivo e limpeza | **Operacional:** somente quatro containers previstos; banco/volumes/backups preservados; sem prune, sem branch/commit/push; imagem backend atualizada e E2E autenticado pelo Nginx real **1/1 PASS Chromium**, ZIPs validados por CRC32 independente. | `docker compose build backend-api` seguido de `docker compose up -d --no-deps --no-build backend-api`. | `target/agerp-backend-build-final.exit=0`, `target/agerp-chromium-final.exit=0`, inventário `docker ps -a` e `docker inspect`. |

| Container | Imagem realmente implantada | Situação verificada |
| --- | --- | --- |
| `agerp-app` | `sha256:8b298958a1f5a088f5c782253e53cab0cf7c1ee854c18a446418242e2c82d418` | running / healthy |
| `agerp-frontend` | `sha256:0762bc7a153edee23deb5dc656524caba47a37321a177e1ddabbcf733cb07606` | running (sem healthcheck próprio) |
| `agerp-python` | `sha256:e6ddcc88671d1d193660fa8e5f10e7f7a145c39fc1f19ad674a63f7dc5477d46` | running / healthy |
| `agerp-postgres` | `sha256:1a6ab3f5345eb6dbe04a1349529caabdb0ab09293a09590fad07b2246bfa4b54` | running / healthy |

**Limites do parecer:** sucesso no servidor significa escrita/fechamento observados,
não que o usuário tenha salvo ou aberto o arquivo. `proxy_read_timeout 300s` é
inatividade **entre leituras do upstream pelo proxy**, não duração máxima do
download nem timeout de leitura do cliente. MVC assíncrono usa prazo de 300 s,
cujo disparo **real** não foi ensaiado. O cliente que não lia terminou em falha
observável, porém sem prova da origem exata desse encerramento. Teste de
1.048.576 linhas e inspeção com leitor de telas seguem declaradamente pendentes.

## Estado vigente do deploy de TESTES — 25/10/2026 (verificação final)

Esta seção **substitui as afirmações de estado atual** nos registros cronológicos
mais abaixo (inclusive os trechos antigos "V02 sem deploy"). Esses trechos continuam
preservados como histórico de ensaios anteriores, não como instruções operacionais.
O ambiente em `http://127.0.0.1:5173` está implantado e foi testado através do
Nginx real, sem mocks de resposta. **Não foi feito novo deploy nesta última rodada:**
as alterações posteriores à imagem estão restritas aos testes e à documentação.

| Container | Imagem em execução (sha256) | Estado observado |
| --- | --- | --- |
| `agerp-app` | `7f314978c99093f1504656df899535f12cb74a99650a47c0801e8ac3d31e5eed` | healthy |
| `agerp-frontend` | `0762bc7a153edee23deb5dc656524caba47a37321a177e1ddabbcf733cb07606` | running (sem healthcheck próprio) |
| `agerp-python` | `e6ddcc88671d1d193660fa8e5f10e7f7a145c39fc1f19ad674a63f7dc5477d46` | healthy |
| `agerp-postgres` | `1a6ab3f5345eb6dbe04a1349529caabdb0ab09293a09590fad07b2246bfa4b54` | healthy |

`docker ps -a` identificou **somente esses quatro containers**, sem temporários
parados. `docker network ls` identificou apenas as redes Docker padrão e a rede
do projeto `tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026_agnet`;
nenhuma rede isolada residual. O banco `agdb` no PostgreSQL 16 contém Flyway
**V9=true e V10=true**. O volume `pgdata` e os backups preexistentes não foram
modificados ou excluídos por esta rodada. A consulta de contas de teste com
e-mail `v02-deploy-%@example.invalid` mostrou **22 BLOQUEADO e 0 sessões ativas**.
Não houve `prune`, `down -v`, migração nova, alteração do projeto Compose ou
limpeza global. Base do repositório: `944e01ec86cebfb881ba1f673c927b1c1aeb7e18`
na branch `dev`, com alterações locais preservadas; sem commit ou push.

**Rechecagem em 25/10/2026, 14:06–14:08 BRT:** `mvn -o -q test` foi
iniciado, mas a chamada de comando expirou antes de observar seu exit code.
Os 42 arquivos XML Surefire criados nesta execução registram **200 testes,
zero falhas, zero erros e zero ignorados**; os processos Java dessa execução
encerraram. Durante a execução apareceram containers efêmeros PostgreSQL 16
Testcontainers e Ryuk, como esperado; uma nova consulta `docker ps -a` após
o término mostrou **exatamente os quatro containers principais** e nenhuma rede
efêmera. Os cinco volumes preexistentes, incluindo `pgdata` e volumes de
validações anteriores, continuaram listados e não foram apagados. A suíte
Python `python -m unittest discover -s tests -v` retornou **2/2 PASS, exit 0**.
`git diff --check` retornou exit 0 (avisos normais de conversão LF/CRLF).
Esta rechecagem não reconstruiu nem reiniciou imagens: os testes autenticados
do deploy abaixo continuam referindo-se às imagens previamente implantadas.

**Regressão final, teste ampliado atualizado:**
`agerp-frontend/tests/e2e/v02-deployed-authenticated.spec.ts` retornou exit code
**0** e **1/1 PASS** individualmente em Chromium (10,8 s), Firefox (15,7 s) e
WebKit (12,4 s). Abrange ADMIN/OPERADOR, autenticação/CSRF, revogação, pedidos,
estoque, auditoria, previsão Python real `SUCESSO`, XLSX com dados/sem dados,
WCAG 2 A/AA pelo axe em 390/1280 px, modais, teclado, foco, responsividade,
cancelamento via AbortController e limpeza dos usuários sintéticos. A condição
de corrida do antigo teste Firefox foi corrigida no **teste**, disparando os
dois handlers UI na mesma tarefa do navegador; não houve mudança de produção.
Os novos testes repetidos nos três navegadores conferem todas as entradas dos
XLSX enviados pelo Nginx com CRC32/tamanho/descompressão independentes do SheetJS,
e rompem um socket HTTP real após os primeiros bytes. Os testes de acessibilidade
automatizados **não** substituem um ensaio manual com leitor de telas.

**Socket real, ressalva essencial:** depois de ler os primeiros 3.484 bytes de
`auditoria_logs/xlsx`, o cliente encerrou a conexão; houve evento
`EXPORTACAO_GERADA`, um terminal `EXPORTACAO_TRANSMISSAO_ENCERRADA` e nenhum
arquivo temporário remanescente em `/tmp`. Como o XLSX era pequeno, o backend
pode ter terminado de escrever antes do fechamento do socket. O evento significa
somente que a escrita do servidor retornou; **não comprova entrega ou salvamento
no navegador**, nem detecção do abandono pelo servidor em transmissão longa.
O ensaio com fluxo longo, cliente lento e pressão real sobre o socket permanece
pendente. Rejeição/timeout do executor e recuperação de temporários após morte
abrupta também não foram reproduzidos fisicamente nesta rodada.

**Carga:** o ensaio autenticado limitado anterior no Chromium registrou 1.622
GETs com HTTP 200 (5 workers após 25 warmups), p50=36,0 ms, p95=58,0 ms,
p99=71,4 ms, duração reportada 17.647 ms. Não foi repetido após a edição
exclusiva dos testes, e não demonstra escalabilidade para produção. A última
consulta de logs recentes do backend não apontou ERROR/WARN no intervalo
analisado. Testes Maven anteriores: relatórios Surefire de 200 testes sem
falhas; o wrapper que os executou expirou e seu exit code final não foi
observado. Permanecem pendentes validação manual com leitor de telas, ensaio
de XLSX >1 milhão de linhas/abas, falha real durante transferência longa e
decisões de TLS/proxy, CORS e políticas de operação para produção.

## Adendo de 25/10/2026 (~11:00 BRT) — validação autenticada concluída no deploy de TESTES

**Estado mais recente:** o deploy de testes já atualizado foi validado pelo Nginx real
em `http://127.0.0.1:5173` com contas descartáveis ADMIN e OPERADOR e sem mocks.
**Playwright Chromium: 1/1 PASS (14,3 s).** A indicação de que os fluxos
autenticados estavam "não executados", no registro histórico de ~06:35 abaixo,
foi superada por esta execução. Isto **não** homologa produção nem elimina as
pendências da V01.

**Destino conferido antes das escritas:** Compose
`tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026`,
PostgreSQL 16 `agdb` no container `agerp-postgres`, volume
`tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026_pgdata`;
Nginx vinculado somente a `127.0.0.1:5173`, backend apontando para
`jdbc:postgresql://postgres:5432/agdb`. O próprio spec confere essas
identidades, o estado e as imagens antes de qualquer escrita. Nenhum serviço
foi recriado ou reiniciado nesta etapa; PostgreSQL e Python continuaram healthy,
backend healthy e Nginx Up (sem healthcheck próprio). Flyway **V9/V10**: sucesso.

| Serviço | ID da imagem efetivamente testada |
| --- | --- |
| `backend-api` (`agerp-app`) | `sha256:758ed5d9581a40d7c576a8ea6b127ffb2fffc55aa2e61b686d3197fe46c4f90a` |
| `frontend` (`agerp-frontend`) | `sha256:7d629275530cc97cc332204be97dbbe446254c23d59856740831e0a14a167548` |
| `postgres` (`agerp-postgres`) | `sha256:1a6ab3f5345eb6dbe04a1349529caabdb0ab09293a09590fad07b2246bfa4b54` |
| `python-ia-api` (`agerp-python`) | `sha256:e6ddcc88671d1d193660fa8e5f10e7f7a145c39fc1f19ad674a63f7dc5477d46` |

**Comando executado** a partir de `agerp-frontend` (PowerShell), somente com
autorização explícita para **novas escritas sintéticas** no banco descartável:

```powershell
$env:E2E_BASE_URL='http://127.0.0.1:5173'
$env:E2E_TEST_DEPLOY_AUTH='I_AUTHORIZE_TEST_ACCOUNTS'
npx playwright test tests/e2e/v02-deployed-authenticated.spec.ts --project=chromium --reporter=line
```

O arquivo `agerp-frontend/tests/e2e/v02-deployed-authenticated.spec.ts` exige
opt-in e IDs de imagem específicos. Gera senhas aleatórias **somente na memória**;
desliga screenshots, vídeos e traces; não persiste tokens, cookies nem senhas.
As contas foram inscritas pela API, com BCrypt/validações normais; **apenas a
conta ADMIN recém-criada** foi promovida por `UPDATE` SQL restrito ao seu ID e
email, mecanismo de bootstrap do próprio harness de testes isolados (essa
promoção SQL direta não gera evento de aplicação). O ADMIN descartável aprovou
o OPERADOR via endpoint regular. Nenhuma conta preexistente foi modificada.

| Fluxo real pelo Nginx | Resultado e alcance da prova |
| --- | --- |
| CSRF, login ADMIN/OPERADOR, credenciais inválidas | **PASS**: CSRF obtido, cookies de login HttpOnly, HTTP 403 esperado sem CSRF e 401 esperado com CSRF válido e credenciais inválidas. `Secure=false` **somente** para HTTP em loopback de testes. |
| Permissões/URLs diretas | **PASS**: OPERADOR recebe 403 em logs, relatórios e XLSX administrativos e não permanece em `/admin`; ADMIN acessa os endpoints administrativos. |
| Sessões e revogação | **PASS**: duas sessões ADMIN independentes; logout invalida uma e rejeita replay de cookie; outra segue autenticada; revogação administrativa da sessão OPERADOR provoca 401. |
| Pedido, estoque e auditoria | **PASS**: cliente 62, produto 62 e pedido 99 sintéticos; `PENDENTE` R$ 71,00, confirmação 7→5 unidades, cancelamento 5→7, dois movimentos e eventos de criação, status, baixa/estorno e previsão consultados. |
| Previsão Python integrada ao pedido | **PASS online**: status real `SUCESSO`, sem fallback nesta execução. Falha/timeout real de rede continua sem ensaio E2E neste deploy. |
| Relatórios e XLSX | **PASS no conteúdo amostrado**: 39 itens no catálogo; três XLSX de clientes abertos com SheetJS, contendo/omitindo o cliente sintético conforme filtros, além do XLSX de auditoria de exportações com ausência de autoalimentação (`X-Export-Id` não incluído no próprio arquivo). Não equivale à revalidação exaustiva dos 39 relatórios. |
| Logs recentes | **Sem sinais de erro inesperado** no recorte amostrado de 30 min: backend últimos 1.000 registros, Nginx 72, Python 178, PostgreSQL 0; 0 linhas com marcadores `ERROR`/`FATAL`/`Unhandled`/`Exception`/HTTP 5xx, 0 `WARN` nas amostras. 401/403 acima são negações esperadas de segurança. |

**Encerramento verificado independentemente por SQL read-only:** usuários
descartáveis IDs **62 e 63**, ambos `BLOQUEADO` e `ativo=false`; **zero sessões
ativas**, **quatro sessões revogadas** e **31 eventos** vinculados aos dois IDs.
OPERADOR foi bloqueado pela API; o ADMIN, que não pode bloquear a si próprio,
foi desativado por atualização SQL restrita ao usuário recém-criado, aumentando
`credential_version`. A revogação residual por SQL reportou **0** sessões.
Foram preservados **cliente 62, produto 62, pedido cancelado 99**, movimentos
de estoque e auditoria para rastreabilidade; nada foi excluído. Nenhum backup,
volume ou dado preexistente foi removido. Sem operações Git.

**Limitações restantes para produção:** avisos `Bad uncompressed size ... != 0`
do parser SheetJS apesar de XLSX legíveis (compatibilidade ZIP64 com leitores
diversos requer ensaio); cancelamento/streaming lento de XLSX com detecção no
backend, falhas e timeouts **reais por rede** da API Python, acessibilidade com
leitor de tela, carga e concorrência ampliadas, nuances temporais de legado,
TLS/proxy/CORS e cookies Secure em ambiente de produção, A07 e compatibilidade
da imagem antiga com schema V10 sem demonstração. Os testes atuais não
autorizam deploy de produção. Para a matriz V01 e testes anteriores, ver
`docs/validacao-v01-p1.md`.

---

## Estado vigente — V02 no Compose de TESTES (25/10/2026, ~06:35 BRT)

**DEPLOY DE TESTES ATUALIZADO E OPERACIONAL; HOMOLOGAÇÃO AUTENTICADA PARCIAL.**
O usuário confirmou que o ambiente atual é exclusivamente de testes e autorizou
interrupção/reconstrução. Produção não foi autorizada. Todas as seções abaixo
que dizem "V02 não implantada/não autorizada" representam **histórico anterior**
à atualização e não são mais o estado operacional vigente.

**Destino:** Compose `tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026`,
branch `dev`, HEAD-base `944e01ec86cebfb881ba1f673c927b1c1aeb7e18`,
árvore de trabalho local não commitada e preservada. A candidata correspondia ao
manifesto SHA-256 de 256 arquivos
`a1480be01a1c8c2826a20e210ffe7423b2226fe101f5928cf3f974095985a190`
antes da inclusão posterior do teste E2E de smoke (não houve nova alteração no
código-fonte das imagens depois do build). Endereço Nginx:
**`http://127.0.0.1:5173`**. Bindings exclusivamente locais:
frontend `127.0.0.1:5173`, backend `127.0.0.1:8080`, Python
`127.0.0.1:8002`, banco `127.0.0.1:15432`. Nenhuma nova infraestrutura,
domínio, HTTPS ou porta pública.

**Serviços/volumes preservados:** `postgres`/`agerp-postgres` e
`python-ia-api`/`agerp-python` permaneceram nos containers originais, sem
recriação; `backend-api`/`agerp-app` e `frontend`/`agerp-frontend` foram
reconstruídos e recriados. Volume original intacto:
`tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026_pgdata`.

| Imagem | Antes | Depois |
| --- | --- | --- |
| Backend | `sha256:0f6719a7f7fe52add10a63a6fbff8b110a76e364341272a9ff2a779e28757043` | `sha256:758ed5d9581a40d7c576a8ea6b127ffb2fffc55aa2e61b686d3197fe46c4f90a` |
| Frontend/Nginx | `sha256:ec999ef29d32fc155e04a3070b62dd1fed42357d78cf65928534fbd105a2f952` | `sha256:7d629275530cc97cc332204be97dbbe446254c23d59856740831e0a14a167548` |
| PostgreSQL | `sha256:1a6ab3f5345eb6dbe04a1349529caabdb0ab09293a09590fad07b2246bfa4b54` | **Não alterada** |
| Python | `sha256:e6ddcc88671d1d193660fa8e5f10e7f7a145c39fc1f19ad674a63f7dc5477d46` | **Não alterada** |

**Backup preservado:** `C:/tmp/agerp-v02-backup-20261025-001901-e24ddaa4/`
(fora do repositório/volume, ACL restrita), dump 67.488 bytes
SHA-256 `A222CBB1AF28BEC6EE5C2C32DF769617F6334A7C530C73706F0ECDFF45085063`,
globals sensível 930 bytes
SHA-256 `7D34A577948CE5390DFD358156437E8192BEFE7B502AB6E5702CA6D06D094E07`.
Restauração anterior em PostgreSQL 16 isolado comprovou leitura, tabelas,
integridade e dados; checksum isolado não basta. Backup é de ~00:19 BRT,
**não** um retrato imediatamente anterior ao deploy de ~06:30. Não publicar
conteúdo de dumps/globals. Cópias e volumes isolados mantidos.

**Execução:** `docker compose config --quiet` aprovado sem divulgar segredos;
`docker compose build backend-api` e `docker compose build frontend` aprovados;
`docker compose up -d --no-deps backend-api` e
`docker compose up -d --no-deps frontend` concluídos. Sem `down -v`, prune,
remoção de volumes, seeds, TRUNCATE, reset de banco ou operações Git.

**Flyway no banco original de TESTES `agdb`: V9 e V10 aplicadas com sucesso**
(~0,123 s de migração, versão instalada V10, dez migrations versionadas).
V9 acrescenta metadados/índices e grants de auditoria; V10 introduz sessões
rastreáveis e índices. **Não houve conversão de timestamps históricos.**
Preservados 107 logs legados com `event_id` nulo; conta técnica `aguser`
permite `SELECT` e `INSERT`, mas não `UPDATE`, `DELETE` ou `TRUNCATE`
na tabela `log_sistema`. Imagem antiga **não foi validada** contra schema V10:
troca de imagem não reverte banco nem constitui plano de rollback.

**Configuração local:** `SPRING_PROFILES_ACTIVE=dev`,
`AGERP_SEED_ENABLED=false`, `JWT_COOKIE_SECURE=false` exclusivamente porque
o acesso atual é HTTP em loopback (inadequado para HTTPS/produção;
cookies `Secure` obrigatórios em HTTPS). `AGERP_TRUSTED_PROXIES` vazio,
sem confiança ampla em rede. `AGERP_CORS_ORIGINS` encaminhada pelo Compose,
default restrito a `http://localhost:5173,http://127.0.0.1:5173`.
CSRF, autenticação e autorização continuam ativos. Python original preservado;
anteriormente `APP_WORKERS=1` foi observado, sem aumento nesta release.

### Testes do deploy de testes efetivamente atualizado

| Comando / cenário | Resultado / evidência |
| --- | --- |
| `docker compose ps`, health/readiness, logs recentes | Backend, PostgreSQL e Python **healthy**; frontend **Up**. GET Nginx `/` 200, backend readiness 200, Python `/health` 200; sem erros relevantes nos logs iniciais filtrados. |
| Flyway V9/V10, integridade histórica e grants | **PASS**: `agdb` versão V10, 107 logs legados mantidos, privilégios restritos verificados. |
| `cd agerp-frontend; $env:E2E_TEST_DEPLOY_URL='http://127.0.0.1:5173'; $env:E2E_BASE_URL=$env:E2E_TEST_DEPLOY_URL; npx playwright test tests/e2e/v02-deployed-smoke.spec.ts --project=chromium --project=firefox --project=webkit --reporter=line` | **12/12 PASS** (4 testes × 3 navegadores), sem mocks HTTP, contra Nginx/backend/PostgreSQL originais atualizados; o spec exige identidade exata do projeto, container, volume e binding local. SPA 200; `/api/auth/csrf` 200 com cookie; POST login sem CSRF 403 **esperado**, com CSRF válido/credencial inválida 401 **esperado**; `/api/auth/me` anônimo 401; CORS permitido só às duas origens locais; headers forwarded forjados não concedem acesso. |
| Python original `POST http://127.0.0.1:8002/predict` com dados sintéticos | **PASS**: modelo real respondeu mínimo 8 e máximo 15 dias. Isso **não prova** integração autenticada com pedidos nem fallback de erro na rede do deploy. |
| Login **válido**, ADMIN/OPERADOR, duas sessões/revogação, pedido/estoque/auditoria autenticados, XLSX autenticado **via Nginx atualizado** | **NÃO EXECUTADOS neste deploy** por ausência de contas de teste autorizadas. Não criar ADMIN, redefinir senha nem confundir 401/403 com login aprovado. Na stack isolada anterior: Playwright autenticado **6/6**, quatro XLSX pelo Nginx, Maven/PG16/Testcontainers **160/160**, frontend unitário **4/4**, lint/build e Python unitário **2/2** aprovados. Provas isoladas não substituem smoke autenticado neste deploy. |

**Pendências V01/produção:** teste de cancelamento XLSX com streaming lento e
detecção no backend; falha/timeout Python real ponta a ponta; acessibilidade
com leitor de tela; cenários adicionais de concorrência, dados legados e carga;
homologação autenticada no deploy real. A07 não foi ampliada. Bench isolado
de 600 GET autenticados (p95 ~34 ms, concorrência 5, Ryzen 5 5500U,
backend ~528–593 MiB) **não demonstra escalabilidade nem SLA**. V01 parcial;
V02 **implantada só em testes**; produção não liberada. Não fazer rollback
automático da imagem antiga; restauração do banco exige autorização específica.

---

### Registro histórico anterior ao deploy de testes (não vigente)

## Estado operacional vigente — verificação isolada de 25/10/2026 (~05:40 BRT)

**A V02 NÃO FOI IMPLANTADA.** Nenhum restart/rebuild/migration ou intervenção
foi executado sobre os quatro containers originais `agerp-postgres`,
`agerp-app`, `agerp-python` e `agerp-frontend`. Não alterar o volume original
`tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026_pgdata`.
Este estado **substitui as afirmações históricas** datadas de 04:45 e anteriores
abaixo, preservadas para rastreabilidade. Validação isolada não autoriza deploy.

- Identidade: branch `dev`, base `944e01ec86cebfb881ba1f673c927b1c1aeb7e18`
  e alterações locais não commitadas. Manifesto SHA-256 de **256 arquivos** de
  código/testes/configuração (método e inclusão em `docs/validacao-v01-p1.md`):
  `a1480be01a1c8c2826a20e210ffe7423b2226fe101f5928cf3f974095985a190`.
  Não usar exclusivamente o commit-base para identificar a candidata.
- Backend isolado `agerp-v01-adminlock-backend-20261025`, imagem
  `agerp-v01-candidate-adminlock:20261025-0500` / ID
  `sha256:1b0ac55c99d4ef9326cb64cb3cf3ecd1a2a64e2069a338ba635ce1383851ba54`.
  Frontend/Nginx isolado `agerp-v01-adminlock-nginx-20261025`, imagem
  `agerp-v01-frontend:20261025-0345` / ID
  `sha256:78ef91e1f27b3cede6bc8fa37ba43a6aeb756b8da74b36652ffbf0e64f90e328`;
  publicado **somente em `127.0.0.1:53993`**. Python real isolado
  `agerp-v01-python-20261025`, imagem
  `sha256:e6ddcc88671d1d193660fa8e5f10e7f7a145c39fc1f19ad674a63f7dc5477d46`.
- Banco exclusivo de E2E: PG16 `agerp-v02-pg-net-20261025-0025`, volume
  `agerp-v02-netpg-data-20261025-0025`, rede
  `agerp-v01-adminlock-net-20261025-0510`, porta PostgreSQL não publicada.
  Outra cópia V10 para estudos de rollback: `agerp-v01-oldcompat-pg-20261025`,
  backup fora do repositório em `C:/tmp/agerp-v01-oldcompat-copy-20261025-0416/`.
  Preservar todo dump, `globals.sql` (sensível), banco isolado, redes e volumes.

### Evidências de regressão e restrições

| Prova | Comando/artefato | Situação |
| --- | --- | --- |
| Suite backend PostgreSQL 16/Testcontainers, inclusive lock de último ADMIN | `mvn.cmd -o "-Dmaven.repo.local=C:/Users/filip/.m2/repository" test`; `C:/tmp/agerp-adminlock-mvn-suite.stdout.log` | **160/160 PASS; BUILD SUCCESS** 05:27 BRT, 0 falhas/erros/pulados; testes de concorrência usuário/perfil **3/3**, pedido/estoque **2/2**, configuração **1/1**, transação/auditoria **4/4**. |
| Unitário frontend, ESLint, TypeScript/Vite | `cd agerp-frontend; node --test tests/unit/httpError.test.mts`; `npm run lint`; `npm run build` | **4/4 PASS**, lint e build `exit 0`. Vite sinaliza bundle grande (~1.202,75 kB). Não existe script `npm test`. |
| Python | `cd services/python-ia; python -m unittest discover -s tests -v` | **2/2 PASS**; integração real com Python **SUCESSO** no E2E; timeout e HTTP indisponível testados **por unidade Java** `IaPrevisaoFallbackTest` **3/3**, não por falha real de rede E2E. |
| Playwright HTTP real pela porta isolada do Nginx | `npx playwright test tests/e2e/v02-isolated-authenticated.spec.ts tests/e2e/v02-isolated-csrf.spec.ts --project=chromium --project=firefox --project=webkit --workers=1 --reporter=line` com `E2E_ISOLATED_BASE_URL` e `E2E_BASE_URL` ambos `http://127.0.0.1:53993`; `C:/tmp/agerp-adminlock-final-3browsers.stdout.log` | **6/6 PASS**: login, cookies/CSRF, duas sessões, revogação/replay/expiração, ADMIN/OPERADOR, pedidos/estoque 7→5→7, auditoria, UI axe 390/1280, IA real, 39 itens do catálogo e **4 XLSX reais**. O spec valida rede/volumes/JDBC/porta antes de escrever. |
| Conteúdo e falhas de relatórios | `RelatoriosIntegrationTest`, `AdminRelatorioExportControllerTest`, Playwright | **39 relatórios XLSX** reabertos pelo POI e 4 via Nginx; erros de `write` no stream ensaiados. Cancelamento de socket do cliente em 3 browsers: `tempFilesBefore=0 tempFilesAfter=0` e `clientDeliveryUnverified=true`; com buffering do Nginx, **não comprova** desconexão vista pelo backend nem entrega completa ao cliente. |
| Backup, V9/V10, legado e grants | Restauração PG16 e migrações **somente em cópias**, evidências existentes registradas abaixo | Cópia: **17 tabelas**, **649 logs**, **107** `event_id NULL` legados; sem FKs inválidas, `SELECT/INSERT` autorizados e `UPDATE/DELETE/TRUNCATE` negados à conta restrita. Nenhuma migration aplicada ao original. |
| Rollback imagem anterior versus V10 | `C:/tmp/agerp-v01-oldcompat-copy-20261025-0416/` | **BLOQUEADO** por recusa explícita de segurança ao tentar a imagem anterior; login/escrita/auditoria/relatórios **NÃO EXECUTADOS**. Não contornar a recusa nem considerar rollback só de imagem viável. |

Carga **somente de homologação**: 600 GET autenticados `/api/admin/logs`,
concorrência 5 **por navegador**, sem erros; p95 Chromium **34,51 ms**,
Firefox **33,89 ms**, WebKit **33,96 ms**. Host AMD Ryzen 5 5500U,
12 CPUs lógicas, Docker ~7,436 GiB; backend amostrado ~528–593 MiB.
Não constitui medida de produção, SLA ou comprovação de escalabilidade.

**Defeito corrigido:** corrida que permitiria a dois ADMINs bloquear um ao
outro, deixando nenhum ativo. `PerfilRepository.findAdminForUpdate` usa lock
pessimista comum e `UsuarioService` serializa a verificação de último ADMIN.
O cenário PG16 prova **um commit, uma recusa, um ADMIN retido e um único evento
de sucesso**, sem enfraquecer autorização ou assertions. Demais arquivos
alterados e matriz de A04 em `docs/auditoria-negocio.md`; os logs completos,
comandos e estatuto de cada pendência em `docs/validacao-v01-p1.md`.

**Pendências técnicas antes da homologação integral:** abort de exportação
durante stream lento, medindo a percepção do backend e conexões; falha e timeout
de Python de ponta a ponta por rede; maior cobertura de concorrência, legado,
interoperabilidade XLSX e acessibilidade; compatibilidade funcional da imagem
antiga com V10 ainda impedida pela recusa explícita da ferramenta.

**Decisões humanas necessárias antes de autorizar janela:** (1) verificar uso
por terceiros, duração aceitável e janela de manutenção (evita interromper
usuários); (2) URL definitiva, HTTPS/Tailscale e IPs exatos de cada proxy
(define `AGERP_TRUSTED_PROXIES` e origem de esquema/IP); (3) origens CORS exatas
(restringe `AGERP_CORS_ORIGINS`); (4) perfil dev/prod e `JWT_COOKIE_SECURE`
(garante cookies seguros no caminho de acesso real); (5) fuso e interpretação
de datas históricas (impede migração temporal equivocada); (6) incluir A07 ou
não (define escopo da release). Ausência de conexões atuais não responde à
primeira decisão. É obrigatória **nova autorização explícita de deploy**.

**Interrupção e recuperação:** duração de migração e indisponibilidade do
ambiente original **não foram aferidas**; no planejamento da janela, manter
backup testado e plano de restauração em instância isolada, identificar imagem
anterior e garantir schema compatível antes de propor rollback. Trocar a imagem
não reverte V9/V10. **A04: substancial/ensaios aprovados; V01: parcial;
V02/deploy: NÃO PRONTO, NÃO EXECUTADO e NÃO AUTORIZADO.**

---

### Histórico operacional anterior (informação substituída pelo estado acima)

## Estado operacional vigente — candidata V01/V02 isolada (25/10/2026, ~04:45 BRT)

**NENHUM DEPLOY REAL AUTORIZADO OU EXECUTADO.** Esta seção prevalece sobre os estados históricos registrados abaixo; não representa conclusão da V01 nem da V02. Os containers originais `agerp-postgres`, `agerp-app`, `agerp-python` e `agerp-frontend` e o volume `tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026_pgdata` devem permanecer intactos. Não aplicar migrations V9/V10 ao banco original antes de autorização explícita e janela confirmada.

**Identificação da candidata:** branch `dev`, commit-base `944e01ec86cebfb881ba1f673c927b1c1aeb7e18`, com alterações locais não commitadas. Manifesto SHA-256 vigente de **256 arquivos** relevantes de código/configuração/testes: `baa33dbdc3d7e360d6973f3785a460694793000a999fe8d7b99a8c1cf27a8353`. O hash anterior, antes do novo teste de concorrência usuário/perfil (255 arquivos), era `fef31b140354f9ec2bed85037b20258e00e7122b51acd0202d89d8792b79be0a`, reproduzido ao excluir apenas esse teste do novo manifesto. Esse manifesto **não inclui documentos**; a adição dos dois testes focados ocorreu após a suíte Maven completa. Detalhes dos arquivos abrangidos, comandos e evidências: `docs/validacao-v01-p1.md` e `docs/auditoria-negocio.md`.

**Imagens candidatas, distintas das originais:** backend `agerp-v01-backend-corrected-20261025` (`sha256:b1830915ab57e3892eb8128091b899be3363f5055655d8a44a33e17ded8f543f`); frontend/Nginx `agerp-v01-nginx-corrected-20261025` (`sha256:78ef91e1f27b3cede6bc8fa37ba43a6aeb756b8da74b36652ffbf0e64f90e328`); Python `agerp-v01-python-20261025` (`e6ddcc88671d`). A imagem anterior do backend original foi identificada como `sha256:0f6719a7f7fe52add10a63a6fbff8b110a76e364341272a9ff2a779e28757043`. Porta HTTP de homologação vinculada exclusivamente ao loopback: `127.0.0.1:53992`. Validar IDs e vínculos antes de qualquer nova execução, pois nomes/portas isolados podem mudar.

**Ambientes de banco isolados preservados:** PostgreSQL 16 para testes candidatos no container `agerp-v02-pg-net-20261025-0025`, volume `agerp-v02-netpg-data-20261025-0025`, rede `agerp-v01-validation-net-20261025`, sem exposição pública de PostgreSQL. Backup do PostgreSQL original e restauração preliminar em cópia V8 foram validados anteriormente no ambiente `agerp-v02-restore-20261025-0019`; V9 e V10 foram aplicadas **somente nessa cópia**, mantendo 107 eventos legados com `event_id` nulo. Não confundir essa restauração com uma migração do ambiente original. Preservar backups/volumes/redes de recuperação.

**Cópia adicional para compatibilidade de rollback (V10, separada):** artefatos fora do repositório em `C:/tmp/agerp-v01-oldcompat-copy-20261025-0416/`: `v10-copy.dump` (126.189 bytes; SHA-256 `1E30F4C4B226AF9E181BE60044595CA56CBEAC5B3FED378A85E478724BC234EE`) e `globals.sql` (1.044 bytes; SHA-256 `8F23C952A9DA180C77AD96D5318198320627D5640032E7340B427981ECAA9CA8`). O arquivo de papéis globais pode conter material sensível: **não imprimir, anexar ou versionar seu conteúdo**. Cópia restaurada em `agerp-v01-oldcompat-pg-20261025`, volume `agerp-v01-oldcompat-pgdata-20261025`, rede `agerp-v01-oldcompat-net-20261025`, sem porta pública. Evidências: 17 tabelas, 649 logs, 107 linhas legadas com `event_id` nulo, zero chaves estrangeiras não validadas; conta técnica permitida para `SELECT`/`INSERT` e recusada para `UPDATE`/`DELETE`/`TRUNCATE`. Checksum por si só não foi tratado como prova de recuperação: houve restauração e consultas na cópia.

**Rollback da imagem anterior: BLOQUEADO / INCONCLUSIVO.** A tentativa de iniciar a imagem anterior contra esta cópia V10 foi expressamente recusada pela ferramenta de segurança, sem execução da ação. Nenhuma rota alternativa foi usada. Portanto não existe evidência funcional de login, escrita, auditoria e relatórios da imagem antiga sobre V10. Iniciar o processo ou trocar apenas a imagem não reverte Flyway nem garante compatibilidade. Não autorizar rollback somente de imagem com base nas provas atuais; qualquer restauração real de backup demanda autorização e procedimento adicional.

**Fluxos exercitados pelo Nginx isolado:** Playwright real autenticado Chromium/Firefox/WebKit **6/6** (2 testes por navegador); login, cookies/CSRF, sessões/revogação/replay, ADMIN/OPERADOR, pedidos e estoque, IA Python online e fallback, XLSX autenticado (quatro downloads) e auditoria. Maven anteriormente **156/156 BUILD SUCCESS**; testes PG16 focados, adicionados depois: concorrência de configuração **1/1 no Surefire** e de usuários/perfis **2/2 no Surefire** (as duas execuções Maven focadas terminaram por timeout do invólucro; **não declarar `BUILD SUCCESS` nessas chamadas nem suíte integral de 159 aprovada**). Frontend unitário **4/4**, `lint` e `build` aprovados; Python **2/2**. Abort real de socket HTTP foi provocado no cliente via Nginx e observado na trilha do servidor, mas não comprova que o backend percebeu cancelamento nem que liberou todos os recursos, devido ao buffering do Nginx. Essa lacuna segue aberta. Testes com `page.route`/mocks não são prova de integração.

**Operação e capacidade:** benchmark limitado a 600 GET autenticados em homologação isolada, concorrência 5, zero erros e p95 aproximado de 31–40 ms; Ryzen 5 5500U/12 processadores lógicos e cota Docker de ~7,436 GiB. Não extrapolar a escalabilidade/latência para produção. O serviço Python observado opera com `APP_WORKERS=1`; verificar dimensões reais, dependências e saúde dos workers antes de qualquer mudança. Não ampliar portas, afrouxar CSRF, usar CORS credenciado permissivo, confiar em redes inteiras como proxies ou ajustar `JWT_COOKIE_SECURE` sem URL/cadeia HTTPS confirmadas.

**Pendências impeditivas e janela:** testar efetivamente a imagem antiga em V10 apenas se a recusa explícita da ferramenta for resolvida pelos meios autorizados; completar prova de cancelamento de exportação no backend, variantes de concorrência como a regra do último ADMIN, integração indisponibilidade/timeout do Python em E2E e suíte integral após os novos testes. As corridas específicas de edição de **usuários/perfis foram exercitadas e aprovadas nos XMLs Surefire**, não permanecendo genericamente sem teste. Obter decisão humana sobre uso por terceiros e janela, URL/HTTPS/Tailscale e proxies exatos, origens CORS, perfil `dev`/`prod` e cookie Secure, interpretação temporal histórica e inclusão de A07. A interrupção e duração de migração/deploy real **não foram medidas nem autorizadas**; planejar backup verificado, imagem anterior identificada, verificação funcional e recuperação com banco compatível antes da janela. **Parecer: A04 substancial porém parcialmente comprovada; V01/candidata parcialmente homologada; deploy real NÃO PRONTO e NÃO AUTORIZADO.**

## Serviços atuais

O `docker-compose.yml` atual define:

```text
postgres
python-ia-api
backend-api
frontend
```

## PostgreSQL

```text
Imagem: postgres:16
Container: agerp-postgres
```

Possui:
- volume `pgdata`;
- healthcheck com `pg_isready`;
- rede `agnet`;
- inicialização por `docker/postgres/init`.

## Microsserviço Python

```text
Container: agerp-python
Porta interna: 8000
```

O serviço é construído a partir de:

```text
services/python-ia/Dockerfile
```

Configurações previstas:
- `APP_HOST=0.0.0.0`
- `APP_PORT=8000`
- `APP_WORKERS=1` (valor efetivo no Compose em 24/10/2026; `api/main.py` o repassa ao Uvicorn)
- `APP_RELOAD=false`

Healthcheck:

```text
GET /health
```

## Backend

```text
Container: agerp-app
Porta interna: 8080
```

O backend depende da disponibilidade saudável do PostgreSQL e do serviço Python de IA.

Variáveis utilizadas:

```text
SPRING_PROFILES_ACTIVE
SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME
SPRING_DATASOURCE_PASSWORD
```

## Frontend

O compose atual utiliza o diretório:

```text
./agerp-frontend
```

O frontend é servido pelo container na porta interna 80.

## Rede

Todos os serviços utilizam a rede Docker:

```text
agnet
```

## Variáveis externas

O compose utiliza `.env` para parâmetros como:

```text
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
HOST_POSTGRES_PORT
HOST_API_PORT
HOST_APP_PORT
HOST_FRONTEND_PORT
```

Nunca versionar segredos reais.

## Comandos básicos

```bash
docker compose config --quiet
docker compose ps
docker compose logs --tail 60 --no-color backend-api frontend python-ia-api postgres
```

Não executar `docker compose up -d --build` sem especificar serviços na
atualização de uma instalação com dados: PostgreSQL e Python devem permanecer
intocados quando não precisam ser reconstruídos. Nunca usar `down -v` ou
`volume rm` na implantação. A atualização seletiva é descrita abaixo e está
condicionada aos gates de backup, migrations e janela autorizada.

## Diagnóstico

```bash
docker compose ps
docker compose logs backend-api
docker compose logs python-ia-api
docker compose logs postgres
```

## Observação

O compose atual possui algumas dependências comentadas, especialmente a dependência direta do backend em relação ao serviço Python. Isso deve ser revisado conforme a integração do modelo de IA evoluir.
# Fronteira HTTP (A01)

O Docker Compose publica backend e frontend somente no loopback do host.
Preserve este bind. O Nginx rejeita as identidades arbitrárias enviadas pelo
cliente (`Forwarded`, `X-Real-IP`, `CF-Connecting-IP` e `X-Forwarded-For`)
e gera o XFF usando apenas o peer TCP observado. O Spring **não** deve usar
`server.forward-headers-strategy=framework`, pois isso substituiria o peer
antes de sua validação. A lista `AGERP_TRUSTED_PROXIES` aceita IPs e CIDRs
explícitos, por exemplo o IP estável do contêiner Nginx se conhecido; seu valor
padrão vazio desabilita a confiança em qualquer header de identidade.
O `TrustedSchemeFilter`, executado antes da cadeia de segurança, aceita
`X-Forwarded-Proto: https` exclusivamente desses peers, preservando o
endereço original para logs. Não aceite o header de conexões diretas.

Em rede Docker com endereços dinâmicos, verifique o peer real antes de definir
o valor e restrinja rede e publicação da API. Não configure automaticamente
`172.16.0.0/12`, `10.0.0.0/8` nem `100.64.0.0/10`. Não presuma que Cloudflare
existe: usá-lo exige validação da rede de origem e política específica na borda.

Para Tailscale Serve ou outro terminador TLS, defina `JWT_COOKIE_SECURE=true`
e publique ao usuário uma URL HTTPS. Headers `X-Forwarded-Proto` somente são
repassados como HTTPS pelo Nginx quando o peer for loopback. Outros modos de
conexão exigem validar o IP/identidade do proxy anterior e configurar a borda
antes da implantação; não confiar no protocolo declarado pelo navegador.

`AGERP_CORS_ORIGINS` recebe origens explícitas separadas por vírgula, sem `*`.
Exemplo local: `http://localhost:5173,http://localhost:3000`. Quando o React
usa o proxy da mesma origem, não é necessário habilitar a origem externa.
`GET /api/auth/csrf` prepara o cookie `XSRF-TOKEN`; POST/PUT/PATCH/DELETE
devem transportar `X-XSRF-TOKEN`, inclusive login e logout. Clientes legados
precisam aderir a este contrato. O filtro A01 isoladamente não exige migration,
mas a evolução integral de auditoria inclui **V9 e V10**; verificar Flyway e
backup antes de iniciar um backend com o novo código.

## V02 — P1: pré-deploy controlado (24/10/2026)

**Resultado: bloqueado antes do deploy.** A V01 declarou a release **NÃO PRONTA**
para deploy (ver `docs/validacao-v01-p1.md`). Além disso, não foi comprovado
backup recuperável nem ensaio de restauração isolada do banco existente.
Nenhuma imagem foi reconstruída, nenhum container foi reiniciado e nenhuma
migration foi aplicada por esta execução da V02.

### Evidência local inicial (sem segredos)

| Checagem | Resultado |
| --- | --- |
| Git | Branch `dev`; árvore com alterações anteriores preservadas; sem operações Git mutantes. |
| Compose | `docker compose config --quiet`: sucesso. Quatro serviços: `postgres`, `python-ia-api`, `backend-api`, `frontend`. |
| Saúde atual | `agerp-postgres`, `agerp-python` e `agerp-app` healthy; `agerp-frontend` running (sem healthcheck próprio). |
| Imagens atuais | PostgreSQL `1a6ab3f5345e`; Python `e6ddcc88671d`; backend `0f6719a7f7fe`; frontend `ec999ef29d32`. IDs abreviados, anteriores à V02. |
| Dados | Volume nomeado `tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026_pgdata` montado em `/var/lib/postgresql/data`, dois binds de inicialização preservados; contagem inicial de `agerp.log_sistema`: **107**. |
| Histórico de banco | PostgreSQL **16.15**; Flyway V1–V8 marcadas `success`; V9/V10 no repositório, **pendentes no banco existente**. |
| Usuários e grants | Runtime `aguser` sem superuser; Flyway `admin` superuser, contas distintas. Antes de V9, `aguser` ainda possui `SELECT`, `INSERT`, **`UPDATE`, `DELETE` e `TRUNCATE`** sobre `agerp.log_sistema`; não declarar proteção de auditoria implantada. |
| Ambiente | Perfil Spring `dev`, seed automático desabilitado, portas de todos os serviços publicadas somente em `127.0.0.1`. Isto **não comprova** ausência de acesso por um proxy/Tailscale ou de usuários externos. |
| Segurança TLS/proxy | `JWT_COOKIE_SECURE` não está `true`; `AGERP_TRUSTED_PROXIES` e `AGERP_CORS_ORIGINS` **não são repassadas** ao backend pelo Compose existente. Revisão de origem/TLS necessária antes de uso com HTTPS real. |
| Python | `APP_WORKERS=1`, `APP_RELOAD=false`; `python -m api.main` e `uvicorn.run(...)` usam esses parâmetros. Dependências instaladas pelo `requirements.txt` (FastAPI, Uvicorn, pandas, NumPy, scikit-learn, joblib, python-dotenv). Imagem Python atual não precisa ser recriada para V9/V10. |
| DNS | Do backend, `postgres`, `python-ia-api` e `frontend` resolvem na rede do Compose. |
| Smoke atual | `GET :8080/actuator/health/readiness` **200**, `GET :8002/health` **200**, `GET :5173/` **200**; `GET :5173/api/auth/csrf` **403** no stack **anterior** à atualização. Não validar login/cookie/CSRF como aprovado. |
| Logs | Últimos 30 minutos: 173 linhas consultadas, sem correspondências `ERROR`, `FATAL`, `Exception`, `SQLSTATE` ou `WARN`; amostra limitada e não prova ausência histórica de erros. |
| Backup/restore | Não identificado dump/snapshot com integridade e restauração isolada verificadas. **Bloqueio de deploy.** |

Os IDs, volumes, contagens e resultados acima são um retrato do host local;
revalidar imediatamente antes de qualquer atualização. A consulta ao banco foi
somente `SELECT`, sem executar scripts de seed ou limpeza.

### Plano de backup e prova de restauração (ainda não executado)

1. Identificar um backup **anterior à migration**, armazenado fora de `pgdata`,
   confirmar data, origem, retenção e integridade (hash). Um volume funcionando
   **não** constitui backup. Se não existir backup, parar e pedir autorização e
   estratégia operacional antes de coletá-lo ou aplicar migrations.
2. Preparar instância **PostgreSQL 16 descartável**, com projeto/nome, volume,
   rede e credenciais distintos. Não apontar `pg_restore`, Flyway, seeds ou
   testes para `agerp-postgres`/`pgdata` da instalação em uso. Não compartilhar
   `SPRING_DATASOURCE_URL` real no teste.
3. Validar o dump (`pg_restore --list <arquivo.dump>` para formato custom,
   ou análise correspondente se backup físico); restaurar **somente** no banco
   isolado, verificando término sem erro, tabelas, sequências, constraints,
   roles/grants, contagens, registros legados e versão Flyway recuperada.
4. Ensaiar **V9 e V10 na cópia** com usuário de migration e validar a role
   técnica restrita, integridade dos 107 eventos de referência (ou baseline
   renovada), sessão/autenticação e leitura dos relatórios. Verificar rollback
   de aplicação **sem downgrade improvisado de schema**: migrations podem não
   ser compatíveis com a imagem antiga. Uma restauração do banco verdadeiro
   exigirá **autorização específica** e janela de manutenção.
5. Confirmar se o ambiente `dev` atende usuários via Tailscale Serve/outro
   proxy; definir janela de indisponibilidade, critérios de rollback e ajuste
   seguro dos cookies (`Secure` em HTTPS) e headers confiáveis com origens
   explícitas. Não ativar HTTP público ou confiança em CIDR amplo.

### Atualização seletiva planejada (não executada)

Somente após o aceite da V01 e todas as verificações de backup/restauração,
credenciais de teste, perfil e janela, confirmar IDs anteriores, testar
`docker compose config --quiet` e executar **apenas**:

```powershell
docker compose build backend-api frontend
docker compose up -d --no-deps backend-api frontend
docker compose ps
docker compose logs --no-color --tail 80 backend-api frontend
```

Esse comando não remove `pgdata` nem recria os dois serviços dependentes, mas
**reinicia backend/frontend** e o startup do backend pode aplicar V9/V10 no
banco persistente. Portanto, não executá-lo como forma de testar a migration
sem todas as pré-condições. O rollback da imagem requer conhecer os IDs acima,
garantir compatibilidade com o schema já migrado e obter aprovação; simplesmente
voltar a imagem antiga **não desfaz V9/V10**.

Após implantação autorizada, repetir health/readiness, DNS, histórico Flyway e
grants; validar por HTTPS (quando existente) login ADMIN/OPERADOR, cookies e
CSRF, duas sessões e revogação, IP/headers forjados, novas auditorias e logs
legados, e download XLSX **através de `frontend`/Nginx**. Testes autenticados
exigem credenciais de ensaio existentes: não criar ADMIN nem redefinir senhas
automaticamente. Documentar URLs de teste apenas sem cookies/tokens/segredos.

## V02 — P1: preparação isolada de 25/10/2026 (sem deploy real)

Este registro **atualiza** o diagnóstico de 24/10 acima: naquela data não havia
restauração comprovada; em 25/10 o backup foi criado e **restaurado** com sucesso.
Continua valendo o bloqueio de deploy da V01. A instância e o volume originais
não foram atualizados, reiniciados ou migrados durante esta preparação.

### Backup PostgreSQL 16 e recuperação comprovada

- Banco de origem: `agdb`, PostgreSQL 16.15; volume original
  `tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026_pgdata`.
  Espaço disponível na unidade C: antes do backup: **55.519.793.152 bytes**.
- Diretório privado fora do repositório e de `pgdata`:
  `C:\tmp\agerp-v02-backup-20261025-001901-e24ddaa4`. ACL herdada removida:
  somente proprietário, `SYSTEM` e administradores locais. Não sobrescrever.
- `agerp-20261025-001901.dump`: **67.488 bytes**, gerado por `pg_dump`
  **16.15** em formato custom, com `--create`; horário observado de conclusão
  **25/10/2026 ~00:19:50 (-03:00)**; SHA-256
  `A222CBB1AF28BEC6EE5C2C32DF769617F6334A7C530C73706F0ECDFF45085063`.
- `globals-20261025-001901.sql`: **930 bytes**, `pg_dumpall --globals-only`
  para reconstruir roles e propriedades globais; SHA-256
  `7D34A577948CE5390DFD358156437E8192BEFE7B502AB6E5702CA6D06D094E07`.
  **Atenção:** o arquivo de globals pode conter hashes; não exibir, compartilhar
  ou adicionar ao Git. Os hashes acima são dos arquivos, não senhas.
- Restauração efetiva em `agerp-v02-restore-20261025-0019`, volume próprio
  `agerp-v02-restore-pgdata-20261025-0019`, rede `none`, sem portas publicadas;
  `pg_restore --exit-on-error --create` e reconstrução dos globais concluídos.
  A cópia recuperada contém **16 tabelas, 44 constraints, 0 FKs inválidas,
  107 eventos de auditoria e 8 migrations Flyway bem-sucedidas**. Roles `admin`
  e `aguser` recuperadas com distinção superuser / não-superuser.
  Contagens foram comparadas ao snapshot, não a um banco ativo congelado.
- Backup e ambos os ambientes isolados **foram mantidos**; não excluir
  automaticamente. Checksum não foi usado como substituto da restauração.

### Ensaio V9/V10 somente sobre cópia

Uma segunda cópia do mesmo backup foi restaurada em
`agerp-v02-pg-net-20261025-0025`, volume
`agerp-v02-netpg-data-20261025-0025`, rede interna
`agerp-v02-isolated-net-20261025-0019`, sem portas no host.

As migrations foram lidas integralmente **antes** da aplicação na cópia:

- **V9**: adiciona metadados correlacionáveis a `log_sistema` (`event_id`,
  `request_id`, `correlation_id`, identificadores de sessão/dispositivo,
  informações HTTP e `changes_json`), versão do evento com default, índices
  de pesquisa/identidade; remove `UPDATE`, `DELETE` e `TRUNCATE` sobre os logs
  das roles pública e técnica. Registros anteriores preservam `event_id NULL`.
- **V10**: cria `sessao_autenticacao` com UUID, FK de usuário, referências de
  dispositivo, criação, validade e revogação em `TIMESTAMPTZ` e índices.
  **Não existe conversão de horário histórico** em V9 ou V10; a origem/fuso dos
  registros legados ainda requer política explícita.
- Startup do backend **candidato** (`agerp-v02-candidate:20261025-0025`, imagem
  `a57d5dc4ba5d`) aplicou V9/V10 via Flyway **somente na cópia**, tempo Flyway
  reportado de **74 ms**, em banco pequeno sem carga concorrente. Resultado:
  **11 migrations**, 17 tabelas, 46 constraints, **0 FKs inválidas**,
  **107 auditorias legadas**, as 107 com `event_id NULL`, nenhuma sessão.
  Assinatura MD5 dos campos históricos não alterados: antes/depois
  `e01a5c6633a0cb484ff4c9e0b8f33894` (não divulga conteúdo).
- Teste de privilégios na cópia: role técnica tem `SELECT`/`INSERT` em
  `log_sistema`, **não** `UPDATE`/`DELETE`/`TRUNCATE`; possui permissões
  operacionais para sessões. Não foram testados bloqueios concorrentes com
  carga real. A imagem antiga `0f6719a7f7fe` **iniciou** apontando à cópia
  migrada, com aviso de schema V10 superior ao V8 conhecido. Esse startup
  **não comprova** compatibilidade funcional, de rollback ou downgrade.

### Diagnóstico HTTP / testes isolados

Serviços candidatos isolados: backend
`agerp-v02-backend-20261025-0030`, proxy interno
`agerp-v02-nginx-20261025-0036` (imagem `bbd47bebae7f`), backend antigo
`agerp-v02-legacy-backend-20261025-0031`. Um segundo Nginx de **testes**,
`agerp-v02-nginx-host-20261025`, foi anexado à rede interna e à rede de ponte
`agerp-v02-nginx-hostbridge-20261025`, expondo **somente**
`127.0.0.1:53988 -> 80`; PostgreSQL isolado continua sem portas no host.

| Requisição (sem divulgar cookies/tokens) | Estado observado | Interpretação |
| --- | --- | --- |
| `GET http://127.0.0.1:5173/api/auth/csrf` no stack **original**, sem sessão/CSRF | **403** | Falha do bootstrap na imagem antiga, não atribuir ao candidato. |
| `GET /api/auth/csrf` no backend **antigo** isolado, sem autenticação/CSRF | **403** | Reproduz o comportamento da imagem antiga em rede de teste. |
| `GET http://127.0.0.1:53988/api/auth/csrf` pelo Nginx **candidato**, sem autenticação/CSRF | **200** | Token pode ser obtido no stack candidato. |
| `POST http://127.0.0.1:53988/api/auth/login`, credenciais sintéticas inválidas, **sem** CSRF | **403** | Rejeição de CSRF esperada. |
| Mesmo `POST`, com cookie XSRF e header CSRF válidos obtidos no GET | **401** | CSRF aceito; autenticação recusada (credenciais inválidas), comportamento esperado. |

Nenhum cookie, token, senha ou hash de usuário foi publicado na evidência.
Depois das seis requisições de login negativo emitidas pelo Playwright isolado,
uma consulta `SELECT` de contagens na **cópia** mostrou **113 logs**:
**107 legados** com `event_id NULL` preservados e **6 eventos novos** com
`event_id` presente. A consulta não mostrou conteúdo dos eventos. Isso
comprova emissão de eventos de login negativo no candidato, **não** auditagem
de alterações de negócio autenticadas.
**Ainda não foi comprovado** login bem-sucedido, duas sessões/revogação,
auditoria criada por usuário autenticado, RBAC ADMIN/OPERADOR e XLSX baixado
pelo Nginx isolado: não existem credenciais de **ensaio descartáveis**
confirmadas. Não utilizar contas reais ou criar/resetar ADMIN original.
O teste de navegador autenticado segue **bloqueado**, distinto das verificações
HTTP de CSRF. Para executar, obter contas de teste autorizadas com dados e
backend exclusivamente isolados. Um ensaio de inserção de ADMIN/OPERADOR
sintéticos na cópia foi recusado pela ferramenta; nenhuma inserção ocorreu.

### Evidências reproduzíveis, configuração e bloqueios

- Maven suíte completa repetida em 25/10: `mvn -o
  -Dmaven.repo.local=C:/Users/filip/.m2/repository test`: **147/147 PASS**
  com Testcontainers PostgreSQL 16; log local
  `C:\tmp\agerp-v02-maven-20261025.stdout.log`. Frontend unitário:
  `node --test tests/unit/httpError.test.mts`: **4/4 PASS** novamente.
  Playwright **com API real e sem mocks**, novo
  `tests/e2e/v02-isolated-csrf.spec.ts`: **3/3 PASS** (Chromium, Firefox e
  WebKit) para GET CSRF, cookie presente, POST sem token rejeitado e POST
  com token aceito pelo filtro CSRF, mas credenciais inválidas rejeitadas.
  `npx --no-install eslint tests/e2e/v02-isolated-csrf.spec.ts` **PASS**;
  `python -m unittest discover -s tests -v` **2/2 PASS** novamente.
  `npm run build`, `npm run lint`, Playwright **mockado** e Python haviam
  passado na V01; testes e2e **reais autenticados não passaram a ser PASS**.
  Nova tentativa de `npm run lint` global em 25/10 expirou pelo limite de
  **30 s** da execução e ficou **INCONCLUSIVA** (não é PASS nem falha ESLint);
  o lint focalizado do novo teste passou. A imagem frontend candidata já tinha
  sido construída com sucesso a partir da implementação atual.
- Reexecução reproduzível do Playwright isolado, em PowerShell a partir de
  `agerp-frontend/`, com o segundo Nginx de teste já iniciado:

  ```powershell
  $env:E2E_BASE_URL='http://127.0.0.1:53988'
  $env:E2E_ISOLATED_BASE_URL='http://127.0.0.1:53988'
  npm run test:e2e -- tests/e2e/v02-isolated-csrf.spec.ts
  ```

  Não apontar essas variáveis para o Compose original nem para produção:
  requisições inválidas de login podem gerar eventos no banco de destino.
  O teste fica `skip` sem `E2E_ISOLATED_BASE_URL` e usa credenciais deliberadamente
  inválidas, não configura usuários ADMIN/OPERADOR.
- `docker compose config --quiet` **PASS** após atualização declarativa do
  `docker-compose.yml`. Pass-through de `AGERP_TRUSTED_PROXIES` (default
  vazio) e `AGERP_CORS_ORIGINS` (defaults locais explícitos já definidos na
  aplicação) agora preparado; **nenhum `docker compose up` foi executado**.
  Código consumidor: `ClientIpResolver`, `TrustedSchemeFilter` e
  `SecurityConfig`; nunca confiar em faixas amplas ou usar `*` com cookies.
- Instalação original segue com Spring `dev` e `JWT_COOKIE_SECURE` não-true.
  Ainda faltam: confirmar se é acessada por outras pessoas, terminador HTTPS,
  origens autorizadas exatas, peers proxy estáveis, escolha dev/prod e política
  de fuso/legado. Uma amostra pontual sem conexões não autoriza janela.
- Medidas V01: 10 mil logs sintéticos, 30 consultas sequenciais JPA,
  p50 **25,729 ms**, p95 **28,536 ms** (Ryzen 5 5500U, 12 CPUs lógicas);
  não refletem HTTPS, usuários simultâneos ou volumetria de produção.
  Tempo Flyway 74 ms é igualmente não representativo de locks em produção.
- **Gates abertos V01:** cobertura transacional A04/concorrência e auditoria
  sensível, semântica temporal de legado, cópia **sanitizada** de variantes de
  esquema, browser autenticado ADMIN/OPERADOR (revogação/replay, URLs diretas,
  filtros e responsividade), XLSX pelo proxy, cancelamento real de download,
  fluxo completo pedidos/estoque/IA/fallback, teste HTTP de carga e decisão
  de inclusão A07. Ver matriz e adendo em `docs/validacao-v01-p1.md`.

### Janela futura e recuperação (não autorizadas)

Antes do deploy, confirmar proprietários de uso do ambiente, janela aprovada,
tratamento de requisições em andamento, tempo máximo de indisponibilidade,
origens/TLS e credenciais não produtivas de homologação. Fazer nova inspeção
do banco e backup antes de mexer em `agerp-app`/`agerp-frontend`.
Planejar reconstrução **somente** de backend/frontend e interrupção de
requisições em trânsito durante a troca; a duração ainda **não foi medida**.
O rollback de imagem deve recuperar exatamente as imagens anteriores, mas
**não reverte V9/V10**; a compatibilidade funcional do backend anterior com
schema novo não foi homologada. Plano de recuperação de banco: preservar
backup pré-migration, validar checksum/retenção, confirmar falha e obter
**nova autorização específica** para restaurar o banco real em janela,
considerando perda de escritas posteriores ao snapshot e alinhamento das
imagens. **Não executar restauração no original automaticamente.**

**Situação final desta preparação:** backup/restauração e Flyway isolado
comprovados; V01 ainda **NÃO APROVADA** e V02 **NÃO CONCLUÍDA / SEM DEPLOY**.

### Atualização da homologação autenticada isolada — 25/10/2026

**Atualiza as pendências antigas de autenticação e XLSX descritas acima.**
Resultado detalhado e matriz de 13 requisitos em `docs/validacao-v01-p1.md`
(adendo de homologação autenticada). O ambiente original permanece intocado;
os resultados abaixo **não autorizam deploy real**.

| Componente | Candidato isolado efetivamente ensaiado | Ambiente original preservado |
| --- | --- | --- |
| PostgreSQL 16 | `agerp-v02-pg-net-20261025-0025`; `agdb`, volume `agerp-v02-netpg-data-20261025-0025`, rede interna, porta **não publicada** | `agerp-postgres`, volume `tcc-desenvolvimento-de-sistemas---etec-dr-domingos-minicucci-filho---2026_pgdata`, porta `127.0.0.1:15432` |
| Backend | `agerp-v02-backend-20261025-0030`, imagem `sha256:a57d5dc4ba5dcdefb017e6b51c5f038c5e0dfee909294afdd670fac72c8c4b56`, JDBC exclusivo `postgres:5432/agdb` na rede isolada | `agerp-app`, imagem `sha256:0f6719a7f7fe52add10a63a6fbff8b110a76e364341272a9ff2a779e28757043` |
| Nginx/frontend | `agerp-v02-nginx-contrast-20261025`, imagem `sha256:279fd96d28531f2517ef67a591f91f24cfcdef5cf740787ce9af42fab9168d15`, somente `127.0.0.1:53990` | `agerp-frontend`, imagem `sha256:ec999ef29d32fc155e04a3070b62dd1fed42357d78cf65928534fbd105a2f952`, porta `127.0.0.1:5173` |

A partir de `agerp-frontend`, o ensaio real **sem mocks** é:

```powershell
$env:E2E_ISOLATED_BASE_URL='http://127.0.0.1:53990'
$env:E2E_BASE_URL=$env:E2E_ISOLATED_BASE_URL
npx playwright test tests/e2e/v02-isolated-authenticated.spec.ts --project=chromium --reporter=line
```

**Resultado registrado:** **1/1 PASS, exit code 0** em Chromium; login real
ADMIN/OPERADOR, CSRF, cookie HttpOnly, duas sessões, logout e replay rejeitado,
continuidade/revogação/expiração/bloqueio, autorização ADMIN e negação OPERADOR,
criação de cliente com auditoria vinculada, busca/modal de logs e axe 390/1280,
catálogo de 39 relatórios e 4 arquivos XLSX baixados pelo Nginx e analisados
com SheetJS (com dados, vazio, filtrado e histórico de exportações). O XLSX do
histórico não contém o ID da exportação que o gerou, mas esse ID consta nos
eventos `SOLICITADA`/`GERADA` da cópia após a geração. O script valida **antes da primeira
escrita** nome, rede, volume, JDBC, ausência de porta PG publicada e origem
`127.0.0.1:53990`; cria contas fictícias e opera somente na cópia descartável.
O teste Spring com Apache POI continua responsável por cobrir os 39 XLSX.
Avisos ZIP de `Bad uncompressed size` no SheetJS exigem investigação adicional
de interoperabilidade; não foram ocultados como inexistentes.

No mesmo cenário isolado, 100 consultas HTTP autenticadas de logs com
concorrência 5 concluíram em 670,46 ms, p50 30,96 ms, p95 44,62 ms,
p99 51,62 ms e zero erros na repetição ampliada. Medições de CPU/memória recolhidas em ociosidade
**não** são pico de carga nem caracterizam capacidade de produção.

A suíte Maven focada `AuditTransactionConcurrencyIntegrationTest` registrou
**4/4 PASS** no Surefire PG16 descartável, incluindo a falha real de INSERT de
auditoria imposta por constraint transacional e revertida automaticamente;
houve **timeout de 33 s da ferramenta**, por isso o exit code final do processo
Maven não foi observado. Os `npm run build` e `npm run lint` subsequentes
terminaram com código de saída 0. Os 147 testes Maven anteriores não incluem
a nova classe e **não devem ser rotulados como uma suíte integral reexecutada
sobre o conjunto mais recente**.

**Pendências de caráter técnico:** completar cobertura A04 para
pedidos/estoque/usuários/configuração, jornada IA/fallback ponta a ponta,
cancelamento real de download e ZIP interoperável, versão sanitizada com
variações legadas e conversões temporais, testes com TLS/proxy reais e
compatibilidade funcional da imagem antiga após V10. Nenhuma conversão de
timestamp histórico foi realizada; origem/fuso desses horários permanecem
desconhecidos. Novas sessões V10 são armazenadas em `TIMESTAMPTZ`.

**Pré-condições humanas, ainda pendentes:** confirmar acesso por terceiros,
janela aprovada e plano de comunicação; URL pública/interna e cadeia de
terminação TLS; IPs exatos de proxies controlados; origens CORS permitidas;
perfil dev/prod e política `JWT_COOKIE_SECURE` validada no acesso efetivo;
decisão sobre A07 na release e política temporal dos registros antigos.
Se o navegador acessa por HTTPS, usar cookie `Secure`, sem ampliar confiança
em headers encaminhados para uma rede inteira. Não aplicar migrations nem
reiniciar os contêineres originais antes de autorização explícita, avaliação
de compatibilidade da imagem antiga e plano de rollback testado na topologia
real. Restaurar o backup real exige autorização específica e consideração de
possíveis escritas feitas após a coleta do dump.

### Complemento operacional da homologação — 25/10/2026, 02:24 BRT

Não houve deploy, migração ou alteração de configuração dos quatro serviços
originais; backup/restore, volumes originais e instâncias de comparação foram
preservados. O ensaio autenticado foi repetido exclusivamente contra
`http://127.0.0.1:53990` (Nginx isolado) e sua rede interna, banco `agdb`
PostgreSQL 16, volume exclusivo `agerp-v02-netpg-data-20261025-0025`.
`agerp-frontend/tests/e2e/v02-isolated-authenticated.spec.ts` confere as
identidades, portas, volumes e JDBC antes de alterar registros sintéticos.

Resultado final: **1/1 Playwright Chromium real PASS**, 600 GETs de logs
autenticados com concorrência 5, 0 erro, 4.694,78 ms, p95 45,57 ms; durante
a carga o backend isolado consumiu 520,6–521 MiB nas duas amostras
`docker stats` (PostgreSQL 83,16–83,41 MiB; Nginx 13,59–13,89 MiB).
Quatro XLSX via Nginx passaram na leitura de conteúdo e verificação dos 44
descritores ZIP64, apesar de avisos de compatibilidade do leitor SheetJS 0.18.5.
Fluxo de pedido/estoque/fallback IA passou; predição Python online não foi
comprovada. Testes focados Maven A04: **4/4 PASS, BUILD SUCCESS** em Testcontainers
PG16 (SQLSTATE `23514` conferido), `C:/tmp/agerp-a04-constraint-validation.stdout.log`.
Build TypeScript e Vite e lint passaram separadamente; bundle grande é aviso.

Evidências e limites de cobertura por imagem e fingerprint estão em
`docs/validacao-v01-p1.md`. A04 permanece parcial, há testes de cancelamento
HTTP real e atualização concorrente ainda pendentes, e a imagem antiga sobre
V10 não foi homologada. Não presumir que as imagens já construídas contenham
todas as alterações posteriores do worktree. A política temporal de legado,
cadeia TLS/proxy, origens CORS e cookies continuam condicionadas a decisões
humanas. **V01 não aprovada integralmente; V02 sem deploy; não executar**
`docker compose up` nos serviços originais sem autorização explícita.
