# Auditoria de negócio — A04 (implementação parcial)

## Matriz vigente — candidata isolada de 25/10/2026 (~05:40 BRT)

**Este quadro prevalece sobre os pareceres históricos abaixo.** A implementação A04
foi ampliada, corrigida e revalidada, mas não está comprovada exaustivamente.
Somente a candidata isolada foi executada; a V01 segue **parcialmente homologada**
e **não há autorização para deploy V02**.

Identificação: branch `dev`, commit-base
`944e01ec86cebfb881ba1f673c927b1c1aeb7e18`, mais mudanças locais não
commitadas. Manifesto SHA-256 de 256 arquivos relevantes de código/testes:
`a1480be01a1c8c2826a20e210ffe7423b2226fe101f5928cf3f974095985a190`.
Backend isolado `agerp-v01-adminlock-backend-20261025`, imagem
`sha256:1b0ac55c99d4ef9326cb64cb3cf3ecd1a2a64e2069a338ba635ce1383851ba54`;
Nginx isolado em `127.0.0.1:53993`, imagem
`sha256:78ef91e1f27b3cede6bc8fa37ba43a6aeb756b8da74b36652ffbf0e64f90e328`;
Python real isolado, imagem
`sha256:e6ddcc88671d1d193660fa8e5f10e7f7a145c39fc1f19ad674a63f7dc5477d46`.
Banco de E2E: PostgreSQL 16 `agerp-v02-pg-net-20261025-0025` no volume
`agerp-v02-netpg-data-20261025-0025`, rede
`agerp-v01-adminlock-net-20261025-0510`; não é o banco original.

| Requisito A04 | Implementação efetiva | Prova sobre a candidata | Resultado e limite |
| --- | --- | --- | --- |
| Clientes, endereços, produtos | `ClienteService`, `EnderecoService`, `ProdutoService`: eventos de criação/edição/inativação/exclusão, diferenças de campos permitidos | `ClienteCrudCacheIntegrationTest`, suíte Maven PG16, E2E Nginx com cliente/produto/logs | **PASS nos casos executados**; outras disputas concorrentes não foram exauridas. |
| Pedidos, itens e edição | `PedidoService`: `CRIACAO_PEDIDO`, `EDICAO_PEDIDO`, `ALTERACAO_ITEM_PEDIDO`; lock em pedido e auditoria na mesma transação | `PedidoServiceTest`, `PedidoAuditoriaConcorrenciaIntegrationTest` **2/2** | **PASS** para alterações e concorrência exercitadas, não para toda combinação de itens. |
| Status de pedidos/estoque | `PedidoService.mudarStatus`, `PedidoRepository`, `EstoqueRepository`: locks ordenados; `ALTERACAO_STATUS_PEDIDO`, `BAIXA_ESTOQUE_PEDIDO`, `ESTORNO_ESTOQUE_PEDIDO` | Corrida de duas confirmações do mesmo pedido e disputa de estoque insuficiente; E2E mudança **7 → 5 → 7** com auditoria | **PASS**; uma baixa/commit quando cabível, sem baixa dupla nas corridas testadas. |
| Usuários e regra do último ADMIN | `UsuarioService` e `PerfilRepository.findAdminForUpdate`: lock pessimista compartilhado para impedir duas ações simultâneas que eliminem o último ADMIN; diferenças permitidas sem nome/e-mail | `UsuarioPerfilAuditoriaConcorrenciaIntegrationTest` **3/3**, incluindo corrida de último ADMIN: um commit, uma negação, um ADMIN preservado e um evento confirmado; Playwright login, sessão/revogação e ADMIN/OPERADOR | **DEFEITO CORRIGIDO e PASS** nas três corridas. Cadastro público pode registrar ator nulo conforme regra existente. |
| Perfis/cargos, hierarquia, permissões | `PerfilService`, controle otimista `@Version` e verificações de autorização | `CargosIntegrationTest`, concorrência de perfil na suíte PG16, E2E de URL direta ADMIN/OPERADOR | **PASS** para conflito de mesma versão e RBAC testados. |
| Configurações | `ConfiguracaoSistemaService`: transação, versão, diff permitido, invalidação de cache após commit | `ConfiguracaoAuditoriaConcorrenciaIntegrationTest` **1/1**, testes de serviço/integração | **PASS** em uma disputa de atualização simultânea: um commit e um evento. Replicação distribuída não comprovada. |
| IA online e fallback | `IaPrevisaoService`: previsão e `CALCULO_PREVISAO_IA`/`FALLBACK_PREVISAO_IA` com status/duração sem payload pessoal | E2E real backend → Python (`SUCESSO`) em Chromium/Firefox/WebKit; `IaPrevisaoFallbackTest` **3/3** (falha HTTP, timeout e falha de auditoria); testes Python **2/2** | **PASS nos cenários cobertos**; indisponibilidade/timeout reais na rede de containers ainda não comprovados ponta a ponta. |
| Transação, concorrência e sigilo | `AuditoriaNegocioService`, `LogSistemaService`: ator de JWT/contexto HTTP, ação, recurso, resultado, correlação, diff permitido; falha de auditoria aborta mutação de negócio | `AuditTransactionConcurrencyIntegrationTest` **4/4**, PG16 real com falha SQL/rollback e operações simultâneas; fluxo de autenticação e auditoria no E2E | **PASS** no rollback/atomicidade e concorrência ensaiados; outras condições de falha exigem cenários próprios. |
| Relatórios e exportações auditadas | `AdminController`/`ExportacaoAuditoriaService`: export ID, eventos separados de geração e flush do servidor, arquivo temporário apagado | **39** relatórios abertos via POI no backend; **4 XLSX reais** pelo Nginx; abort de socket em **3 navegadores** com temporários **0 → 0**; `AdminRelatorioExportControllerTest` cobre erro no `write` | **PARCIAL**: `TRANSMISSAO_ENCERRADA` comprova flush no servidor, **não** entrega ao cliente; Nginx buffering não permite afirmar que backend detectou desconexão nem aferir conexões sob streaming lento. |
| Consultas sensíveis | Política de auditoria de leitura de dados pessoais ainda requer definição explícita | Não há teste novo ou política aprovada de auditoria de leitura | **PENDENTE de decisão de escopo**; proibido registrar dados pessoais para simular cobertura. |

Em todos os diffs de negócio, preservar a lista positiva: não persistir
senhas/hashes, JWT, cookies, CPF/CNPJ, telefone, e-mail, endereço completo,
observações livres nem o corpo da chamada de IA. Os casos testados verificam
eventos apenas para transações confirmadas, correlação e ausência de dados
proibidos. Permanecem legados **107 eventos com `event_id NULL`** na cópia
restaurada, sem conversão temporal retroativa; não são falha da candidata.

**Resultado reproduzível atual:** `mvn.cmd -o
"-Dmaven.repo.local=C:/Users/filip/.m2/repository" test`: **160/160**,
0 falhas, 0 erros, 0 ignorados, `BUILD SUCCESS` (05:27 BRT),
`C:/tmp/agerp-adminlock-mvn-suite.stdout.log` e `target/surefire-reports/`.
No frontend, `node --test tests/unit/httpError.test.mts` **4/4**, `npm run
lint` e `npm run build` **exit 0**; no Python, `python -m unittest
discover -s tests -v` **2/2**. Playwright real autenticado pelo Nginx:
**6/6** em Chromium/Firefox/WebKit, registro em
`C:/tmp/agerp-adminlock-final-3browsers.stdout.log`. Os ensaios antigos 156/156
e os XMLs de Maven com timeout foram substituídos pela suíte 160/160;
testes com `page.route` continuam somente como evidência de UI.

**Pendências técnicas:** verificar falha/timeout do Python por rede real;
cancelamento XLSX durante streaming lento com desconexão detectável pelo backend
e medição de conexões; combinações adicionais de concorrência, cenários legados,
leitores XLSX independentes e acessibilidade com tecnologias assistivas reais.
A imagem antiga contra cópia V10 **não foi testada** após recusa explícita da
ferramenta; rollback somente de imagem não está homologado. Os artefatos da
cópia foram preservados, sem contornar a recusa. Detalhes, procedimentos e
decisões humanas estão em `docs/validacao-v01-p1.md` e `docs/docker.md`.

**Parecer separado:** A04 **substancialmente implementada e validada nas
operações ensaiadas**, não exaustiva; V01 **parcial/inconclusiva nos pontos
listados**; V02/deploy **não pronto, não executado, não autorizado**.

---

### Histórico anterior (substituído pelo quadro vigente acima)

Os eventos usam a transação do serviço de domínio e `log_sistema.changes_json` da migração V9 (A02). O ator é recuperado exclusivamente do `SecurityContext` autenticado pelo JWT (A03). Falha ao registrar o evento interrompe a transação; transações revertidas não deixam evento de sucesso. O contexto HTTP, sessão e correlação vêm da infraestrutura A02/A03.

| Operação | Serviço | Evento | Recurso | Dados persistidos |
| --- | --- | --- | --- | --- |
| Criar/editar/excluir cliente | ClienteService | CRIACAO_CLIENTE / EDICAO_CLIENTE / EXCLUSAO_CLIENTE | CLIENTE | tipo (edição apenas se mudou); dados pessoais excluídos |
| Criar/editar/excluir endereço | EnderecoService | CRIACAO_ENDERECO / EDICAO_ENDERECO / EXCLUSAO_ENDERECO | ENDERECO | clienteId na criação, estado na edição; endereço exato excluído |
| Criar/editar/inativar/excluir produto | ProdutoService | CRIACAO_PRODUTO / EDICAO_PRODUTO / EXCLUSAO_LOGICA_PRODUTO / EXCLUSAO_PRODUTO | PRODUTO | preço, custo, ativo, quantidade atual e mínima, quando mudam |
| Criar/editar/excluir cargo | PerfilService | CRIACAO_PERFIL / EDICAO_PERFIL / EXCLUSAO_PERFIL | PERFIL | nível de autoridade quando muda |
| Criar/editar/status/senha usuário | UsuarioService | eventos textuais anteriores | USUARIO | ainda sem diff JSONB completo |
| Alterar configurações | ConfiguracaoSistemaService | ALTERACAO_CONFIGURACOES | CONFIGURACAO | nomes de campos alterados apenas na memória; diff JSONB pendente |
| Criar/editar/status/cancelar/excluir pedido | PedidoService | **PENDENTE** | PEDIDO, ITEM, ESTOQUE | pendente: correlação item/estoque sob concorrência |
| Cálculo/fallback/persistência IA | IaPrevisaoService | **PENDENTE** | PREVISAO | pendente: evento sem payload pessoal e tratamento da persistência silenciosamente falha |
| Consulta sensível e consulta de auditoria | Controllers/LogSistemaService | **PENDENTE** | DADOS_PESSOAIS/AUDITORIA | depende de política de leitura autorizada |

Campos explicitamente excluídos do histórico: senha e hash, tokens e chaves, CPF/CNPJ, telefone, e-mail e nome do cliente, logradouro, número, bairro, CEP, coordenadas, observações de pedidos e corpo completo da requisição da IA. A lista positiva no `LogSistemaService` rejeita chaves não autorizadas. Diferenças incluem `{ "antes": ..., "depois": ... }`; valores nulos significam ausência de valor anterior/posterior. Valores monetários são comparados com `BigDecimal` e gravados como strings decimais canônicas.

Limitações atuais: não há travamento transacional específico nos cadastros para assegurar snapshot correto contra duas atualizações simultâneas. A cobertura é parcial: não aprovar A04 integralmente sem implementação e testes de pedido/estoque, usuário, configuração, IA, leituras sensíveis, rollback e concorrência. Não foram criados fluxos de inventário ou entrega inexistentes.
# Estado vigente da A04 — evidência de 25/10/2026 (~04:45 BRT)

**Esta seção substitui a matriz histórica de implementação parcial abaixo.** O texto antigo é mantido para rastreabilidade; suas linhas `PENDENTE` sobre pedidos, configurações e IA **não descrevem a candidata atual**. Nenhum deploy foi feito.

| Requisito A04 | Implementação candidata | Teste/evidência | Parecer |
| --- | --- | --- | --- |
| Clientes, endereços e produtos | `ClienteService`, `EnderecoService` e `ProdutoService`: eventos de criação/edição/exclusão ou inativação, diffs de campos permitidos | `ClienteCrudCacheIntegrationTest`, regressão Maven 156/156, Playwright autenticado de cliente/produto/auditoria | **Coberto nos cenários exercitados**; não prova todas as combinações de atualização concorrente. |
| Cargos/perfis e hierarquia | `PerfilService`: criação/edição/exclusão com nível de autoridade; verificação RBAC, controle otimista por `@Version` | `CargosIntegrationTest`, `UsuarioServiceUpdateTest`, Playwright ADMIN/OPERADOR e `UsuarioPerfilAuditoriaConcorrenciaIntegrationTest` **1/1 cenário de perfil**: dois administradores simultâneos com mesma versão, exatamente um commit, um conflito e um evento `EDICAO_PERFIL` | **Aprovado no conflito ensaiado**, não na regra de último administrador ou em todas as edições possíveis. |
| Criação, edição e itens do pedido | `PedidoService.criar/atualizar`: `CRIACAO_PEDIDO`, `EDICAO_PEDIDO`, `ALTERACAO_ITEM_PEDIDO`, diffs de valor, IDs e quantidades; `@Transactional` e bloqueio pessimista em edição | `PedidoServiceTest`, `PedidoAuditoriaConcorrenciaIntegrationTest`; Playwright pedido real | **Coberto nos fluxos testados**. |
| Transições e movimentos de estoque | `PedidoService.mudarStatus`: `ALTERACAO_STATUS_PEDIDO`, `BAIXA_ESTOQUE_PEDIDO`, `ESTORNO_ESTOQUE_PEDIDO`, movimentação na mesma transação e locks de pedido/estoque em ordem determinística | PG16 real: duas confirmações simultâneas do mesmo pedido = uma baixa; dois pedidos disputando estoque insuficiente = um único commit. E2E 7 → 5 → 7 com eventos | **Aprovado para essas corridas específicas**, não cobertura universal de estoque. |
| Usuários, senhas, status e permissões | `UsuarioService`: `findByIdForUpdate`, status/ativo/perfil/estado seguros em `changes_json`; alterações de nome/e-mail somente como indicação de campos, sem valores pessoais; controle do último ADMIN | `UsuarioServiceUpdateTest`, `UsuarioServiceApprovalTest`, `UsuarioServicePasswordResetTest`, login/revogação/RBAC pelo Nginx; `UsuarioPerfilAuditoriaConcorrenciaIntegrationTest` **1/1 cenário de usuário**: aprovação e edição simultâneas, dois commits/dois eventos, campos convergentes, sem nome/e-mail no JSON | **Aprovado no cenário ensaiado**; último ADMIN sob corrida e outras alterações concorrentes seguem sem prova. Cadastro público pode ter ator nulo por design. |
| Configurações | `ConfiguracaoSistemaService`: `@Version`, `@Transactional`, diff de limite, regras de estoque, alertas e timeout IA; nome da empresa deliberadamente excluído; cache invalidado após commit | `ConfiguracaoSistemaServiceTest`, `ConfiguracaoSistemaIntegrationTest`; `ConfiguracaoAuditoriaConcorrenciaIntegrationTest` **1/1 Surefire PASS** PG16 com duas atualizações disputando a mesma versão: um commit/uma auditoria; o processo Maven teve timeout de invólucro, sem exit code final observado | **Aprovado no conflito ensaiado**, sem evidência de distribuição entre réplicas. |
| IA online e fallback | `IaPrevisaoService`: previsão salva e `CALCULO_PREVISAO_IA` ou `FALLBACK_PREVISAO_IA` com status/versão/duração permitidos na transação | Python online real pelo Nginx (`SUCESSO`); `IaPrevisaoFallbackTest` **3/3** para HTTP recusado, timeout e falha de auditoria; Python **2/2** | **Cenários testados aprovados**; indisponibilidade real do contêiner Python no E2E e estresse/concor­rência de previsão não foram comprovados. |
| Falha de auditoria, rollback, correlação e sigilo | `AuditoriaNegocioService`, `LogSistemaService`: transação de negócio compartilhada, contexto JWT/HTTP, lista positiva de campos | `AuditTransactionConcurrencyIntegrationTest` **4/4** com falha SQL real/rollback e 8 clientes simultâneos; testes de filtros, logs de pedido e XLSX | **Coberto para falhas injetadas e casos reais testados**; não extrapolar para todos os caminhos de erro. |
| Leituras de dados pessoais e consultas sensíveis | Sem mudança expansiva: política de auditoria de leitura exige autorização explícita | Não testado como requisito novo da release | **Pendente de política/escopo humano**; não introduzir log de PII sem autorização. |

Os eventos de sucesso de operações transacionais que foram revertidas **não aparecem** nos testes de falha exercitados. `changes_json` restringe chaves e valores: não gravar senhas/hashes, tokens, cookies, CPF/CNPJ, endereço exato ou payload completo de IA. O ator, ação, recurso, resultado, `event_id`/correlação são conferidos nos testes com JWT/Playwright; a criação pública/sem autenticação é exceção de ator nulo. `TRANSMISSAO_ENCERRADA` na exportação indica escrita/flush observada pelo servidor, não confirmação de entrega ao cliente.

**Evidência incremental:** `target/surefire-reports/TEST-com.agerp.agerp.UsuarioPerfilAuditoriaConcorrenciaIntegrationTest.xml` informa **2 testes, 0 falhas, 0 erros, 0 pulados, 24,42 s**, com PostgreSQL 16/Testcontainers. O invólucro da execução Maven excedeu timeout (`exit 124`), portanto **não existe `BUILD SUCCESS` comprovado para essa invocação**, e a suíte integral posterior à adição desse teste não foi reexecutada. O manifesto da candidata local agora tem 256 arquivos, SHA-256 `baa33dbdc3d7e360d6973f3785a460694793000a999fe8d7b99a8c1cf27a8353`; imagens isoladas não precisaram de rebuild, pois a mudança posterior ao último build foi somente no código de teste/documentos. Os dois casos não equivalem à exaustão de todas as corridas.

**Parecer A04:** implementação substancial com cenários relevantes aprovados, mas **não aprovação irrestrita**: agora há prova pontual de concorrência real também em usuário e perfil, além de pedidos, estoque e configuração; continuam fora da prova concorrência sobre o **último ADMIN**, caminhos transacionais adicionais, cancelamento efetivo de transmissão XLSX e leituras sensíveis que dependem de política explícita. Não inventar operações de inventário inexistentes para alegar cobertura. Ver `docs/validacao-v01-p1.md` para a matriz V01, artefatos e status de homologação.
