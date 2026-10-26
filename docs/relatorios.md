# AGERP — Relatórios administrativos (A06/P1)

## Encerramento técnico em TESTES — 25/10/2026 (~16h BRT)

Esta seção e a de `docs/docker.md` denominada **Encerramento das pendências
técnicas** substituem, para o estado vigente, as notas cronológicas abaixo.
Os apontamentos antigos permanecem como histórico; especialmente as afirmações
de que o Nginx, a desconexão longa e a rejeição do executor não foram ensaiados.
Não há homologação de produção.

| Pendência | Resultado atual | Correção, se necessária | Evidência |
| --- | --- | --- | --- |
| Maven e relatórios | **207/207 testes aprovados**, 45 XMLs Surefire da execução 15:44–15:45, exit do processo **0** | `RelatoriosIntegrationTest` deixou de imprimir headers MockMvc concorrentes; asserts HTTP mantidos | `target/agerp-full-verified.exit`, `.log`, `target/surefire-reports/TEST-*.xml` |
| XLSX via Nginx e clientes lentos | **Três cenários observados:** 14.938.537 bytes completos em 27.825 ms; abortado com 543.123 bytes em 6.063 ms; leitura parada 75 s e fluxo interrompido após 80.952 ms/5.650.059 bytes. Auditoria terminal única e spool limpo. **Não foi identificado qual timeout interno causou o último encerramento**. | Semáforo e arquivo temporário vinculados ao callback; `proxy_buffering off` | `target/agerp-long-stream.log` e `.exit=0`; `v02-long-stream.spec.ts`; 60.000 registros de prova excluídos por marcador |
| Morte abrupta/recuperação | **Aprovado em JVM filha encerrada à força**, sem depender de finally/hook; arquivo próprio recuperado, desconhecidos e ativos preservados; isolamento Docker limpo | Lock de SO, spool por dono e diário de recursos com labels | `ExportacaoTemporariosTest`, `scripts/docker/invoke-isolated-probe.ps1`, `scripts/docker/.isolation-runs/` |
| Saturação e timeout | HTTP 503 JSON sob executor saturado, seguido de HTTP 200 **aprovados em integração Spring**; listener de timeout/corrida **aprovado em teste de ciclo de vida**. **Timeout MVC de 300 s no socket não comprovado** | Executor 2 core/4 max/fila 8/AbortPolicy, listener de limpeza e auditoria | `ExportacaoAsyncHttpIntegrationTest`, `ExportacaoAsyncLifecycleTest` |
| Mais de 1.048.575 registros/aba | **Não comprovado no limite real.** Código prevê criação de `Dados 2` após 1.048.575 dados e cabeçalho, mas falta ensaio milionário | Validador ZIP/XML independente corrigido para PowerShell 5.1 e testado com fixture de **limite reduzido** (3 dados em 2 abas); **não substitui** ensaio real | `scripts/docker/validate-xlsx-row-limit.ps1` e receita abaixo |
| Acessibilidade | axe A/AA em 390/1280 px no Chromium; **leitor de telas manual pendente** | Roteiro abaixo; nenhuma configuração do sistema alterada | `target/agerp-chromium-spool-verified.exit=0`, `v02-deployed-authenticated.spec.ts` |
| Deploy e limpeza | **TESTES operacional**, Nginx `127.0.0.1:5173`, somente `agerp-postgres`, `agerp-app`, `agerp-python` e `agerp-frontend`. V9/V10 e volumes preservados | Backend atualizado seletivamente; E2E autenticado pelo Nginx passou 1/1 Chromium | `target/agerp-backend-build-final.exit=0`, `target/agerp-chromium-spool-verified.exit=0`, inventário de containers em `docs/docker.md` |

**Semântica:** `EXPORTACAO_TRANSMISSAO_ENCERRADA:OBSERVADO` significa que
o servidor concluiu sua escrita, **não** prova que o usuário recebeu, salvou ou
abriu o XLSX. No teste longo, o cliente lento recebeu todos os bytes; abort e
pausa prolongada causaram `EXPORTACAO_FALHA:FALHA`. O backend foi amostrado
em 509,7→562,4 MiB e o PostgreSQL em 80,96→145 MiB (não são picos).
O timeout `proxy_read_timeout 300s` limita o intervalo de leitura do upstream
pelo Nginx, não a duração total do download nem o tempo sem leitura do cliente.

### Limite real de abas — como reproduzir em máquina dimensionada

**Pendente.** Neste computador foram observados aproximadamente 7,4 GiB de
memória Docker e 53,9 GiB livres na unidade C; não se arriscou gerar mais de
um milhão de linhas com 19 colunas, dados temporários do POI e XLSX simultâneos.
Antes do ensaio, reservar memória, disco, espaço temporário e tempo suficientes
em **cópia descartável/isolada do banco**, nunca no banco de produção nem com
outros usuários. Não converter esta receita em resultado aprovado sem executá-la.

Com o AGERP dessa cópia já autenticado como ADMIN, sem escritas concorrentes,
gerar **1.048.576** logs sintéticos (o CSV de IDs precisa conter **todos** os
logs elegíveis à exportação, inclusive os anteriores). Exemplo PowerShell,
substituindo o marcador pelo UUID da execução:

```powershell
New-Item -ItemType Directory -Force -Path C:\tmp | Out-Null
$marker = 'agerp-limit-' + [guid]::NewGuid().ToString('N')
$sql = "INSERT INTO agerp.log_sistema (acao, entidade, recurso_id, resultado, detalhes) SELECT 'SYNTHETIC_LIMIT', 'TEST_PROBE', '$marker', 'TEST', md5(g::text) FROM generate_series(1,1048576) g"
docker exec agerp-postgres psql -X -U admin -d agdb -v ON_ERROR_STOP=1 -c $sql
docker exec agerp-postgres psql -X -U admin -d agdb -Atc "SELECT id_log FROM agerp.log_sistema ORDER BY data_hora DESC,id_log DESC" | Set-Content -Encoding ascii C:\tmp\agerp-ids.txt
$expectedCount = [long](docker exec agerp-postgres psql -X -U admin -d agdb -Atc "SELECT count(*) FROM agerp.log_sistema")
$expectedCount
```

Registrar a contagem retornada, baixar pelo **Nginx** `/api/admin/relatorios/auditoria_logs/xlsx`
sem filtros com a sessão ADMIN já autenticada e salvar o arquivo completo como
`C:\tmp\agerp-limit.xlsx`. Executar a validação, passando a contagem exata
da consulta anterior:

```powershell
.\scripts\docker\validate-xlsx-row-limit.ps1 -Path C:\tmp\agerp-limit.xlsx -ExpectedDataRows $expectedCount -ExpectedOrderedIdsPath C:\tmp\agerp-ids.txt
```

O script lê XML por fluxo, verifica ordem e nomes das abas, limites e índices
de linhas, cabeçalhos idênticos, filtros e congelamento, e compara cada ID
numérico da coluna A com o arquivo de origem na **mesma ordem**. O arquivo de
IDs deve ser produzido antes da requisição, pois os próprios eventos de
exportação são excluídos pelo corte interno. Se houver outros eventos no
intervalo, a comparação é inválida; repetir em ambiente exclusivo. A validação
de **valores agregados em Totais**, além da estrutura, exige confronto com a
consulta SQL/POI correspondente: o validador não certifica somas.
Somente após a conferência, excluir **exclusivamente** os logs da prova
com o marcador exclusivo (confirmar que a contagem apagada é 1.048.576):

```powershell
docker exec agerp-postgres psql -X -U admin -d agdb -v ON_ERROR_STOP=1 -c "DELETE FROM agerp.log_sistema WHERE entidade='TEST_PROBE' AND acao='SYNTHETIC_LIMIT' AND recurso_id='$marker'"
```

Manter os demais dados da cópia isolada. Sem execução não há aprovação.

O parâmetro `-MaxRowsPerSheet 3` existe apenas para autoteste de fixtures
pequenas: caso passe, o script imprime **SIMULACAO**, não atesta o Excel real.
O fixture de três IDs passou; um ID de origem divergente foi rejeitado.

### Leitor de telas — roteiro manual pendente

Sem instalar nada ou alterar ajustes globais, usar Narrador já disponível
(ou leitor homologado pelo avaliador) no **deploy de TESTES**. Acessar como ADMIN
por teclado; localizar menu **Relatórios**, título, filtros e botão de exportação;
conferir ordem de foco, rótulos anunciados, papel/estado de componentes, erros
de intervalo de datas, feedback de download e possibilidade de cancelar.
Repetir sem permissão ADMIN para observar o acesso negado. Registrar navegador,
leitor/versão, sequência de teclas, fala observada e eventuais defeitos; não
marcar aprovado até concluir essa inspeção.

HTTPS, domínio, proxies externos, CORS e política de operação de produção
dependem de decisões de implantação e não bloqueiam a aprovação técnica em TESTES.

## Evidência anterior de interoperabilidade — 25/10/2026 (superada onde indicado acima)

No deploy de TESTES `http://127.0.0.1:5173`, a suíte
`agerp-frontend/tests/e2e/v02-deployed-authenticated.spec.ts` passou
individualmente em Chromium, Firefox e WebKit (**1/1 PASS por navegador,
exit code 0**). Em cada execução, foram baixados quatro XLSX reais através
do Nginx, incluindo com cliente selecionado, sem correspondência e auditoria
de exportações; todas as quatro planilhas foram abertas e inspecionadas pelo
SheetJS. A suíte de integração Java previamente executada cobriu os 39 IDs
e abertura por Apache POI com PostgreSQL Testcontainers real. O teste de
frontend aciona o cancelamento via UI na mesma tarefa do navegador para
evitar que a resposta de uma planilha pequena termine antes do segundo clique.
Não usa mocks de resposta. Esse teste prova o comportamento do AbortController
na UI, não o cancelamento da geração já finalizada pelo servidor.

**Diagnóstico dos avisos SheetJS:** `xlsx@0.18.5` ainda escreve
`Bad uncompressed size: N != 0` ao ler esses arquivos. O verificador
independente implementado no teste E2E interpreta o diretório central ZIP,
descomprime cada entrada com `node:zlib`, compara CRC32 e tamanho efetivo e
confere os cabeçalhos locais. Em cada um dos quatro XLSX examinados houve
**11/11 entradas íntegras**, todas com bit 3 de ZIP (`data descriptor`) e
tamanho 0 no cabeçalho local, sendo o tamanho real fornecido pelo diretório
central. Isto explica o aviso do SheetJS e é permitido pela estrutura ZIP;
não se identificou corrupção nos arquivos testados. O Apache POI valida a
interpretação semântica do XLSX em testes Java. Avisos não foram suprimidos.
Não extrapolar o resultado de quatro documentos para cargas/formatos não
ensaiados, incluindo planilhas com múltiplas abas por limite de linhas.

**Registro anterior da desconexão curta:** a suíte fecha um socket HTTP autenticado após receber
os primeiros 3.484 bytes de `auditoria_logs/xlsx` pelo Nginx, verifica o
evento de geração, um terminal de auditoria e ausência de arquivo temporário
remanescente em `/tmp`. Nos três navegadores o terminal foi
`EXPORTACAO_TRANSMISSAO_ENCERRADA`, não `EXPORTACAO_FALHA`: o backend pode
ter concluído a escrita do arquivo pequeno antes de observar o fechamento.
**Não significa entrega integral ao cliente.** Detecção de desconexão durante
transferência prolongada com backpressure, rejeição/timeout de executor e
limpeza em morte abrupta ainda exigem teste específico em ambiente isolado.
O Nginx vigente define `proxy_buffering off` e `proxy_read_timeout 300s` na
rota XLSX, não o timeout padrão de 60 s mencionado no registro histórico
abaixo. Acessibilidade axe A/AA em 390/1280 px foi aprovada em três
navegadores; não foi realizado teste manual com leitor de telas.

## Contrato público e acesso

A interface **Admin → Relatórios** consulta `GET /api/admin/relatorios` e baixa `GET /api/admin/relatorios/{id}/xlsx`. Todos exigem **ADMIN** via regra HTTP e controlador. `OPERADOR`, mesmo autenticado com JWT, recebe 403; requisição não autenticada não recebe arquivo. O ID do catálogo define filtros disponíveis; parâmetros não aplicáveis são ignorados pela consulta (a interface envia apenas os anunciados).

Parâmetros opcionais: `inicio`, `fim` (datas ISO `YYYY-MM-DD`, período com último dia **incluído** via limite exclusivo em 00:00 do dia seguinte), `clienteId`, `produtoId`, `usuarioId` (inteiros positivos) e `status` (enum textual convertido para maiúsculas). Intervalo invertido retorna 400; ID desconhecido retorna 400 conforme contrato legado. Datas se referem ao campo declarado em cada visão, e não à data de geração.

O retorno bem-sucedido é `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment`, `Cache-Control: no-store, private` e `X-Export-ID: <UUID>`; CORS expõe `X-Export-ID` e `X-Request-ID`. O frontend tenta baixar o Blob e **não confirma** que foi salvo ou aberto. Resposta com falha *antes* dos cabeçalhos contém JSON do tratador HTTP. Depois de iniciada a transmissão, falha deve encerrar a resposta incompleta, não adicionar JSON aos bytes XLSX.

## Matriz completa: IDs, filtros, origem, colunas e decisão

Legenda dos filtros: `D` = `inicio,fim`; `C` = `clienteId`; `P` = `produtoId`; `U` = `usuarioId`; `S` = `status`; `—` = nenhum. As colunas abaixo aparecem **nessa ordem**, conforme `RelatorioAdminService`; títulos aqui são abreviados para leitura, mas a grafia exata e os tipos estão no catálogo do código. `Preservar` significa manter SQL, cabeçalhos e regra anteriores. `Melhorar` é alteração aditiva de rastreabilidade/consistência sem mudança da métrica. `Expandir` é nova visão baseada em A02–A05. Não se marcou `Corrigir` em consultas preexistentes sem defeito de cálculo reproduzido.

| ID | Filtros | Tabelas / semântica | Colunas, na ordem | Decisão |
| --- | --- | --- | --- | --- |
| `clientes_cadastro` | D,C | cliente, data_cadastro | Código; Nome/Razão; Tipo; CPF/CNPJ; E-mail; Telefone; Cadastro | Preservar |
| `clientes_tipo` | D,C | cliente, GROUP BY tipo | Tipo; Clientes | Preservar |
| `clientes_sem_pedidos` | D,C | cliente, NOT EXISTS pedido | Código; Nome/Razão; Tipo; CPF/CNPJ; E-mail; Telefone; Cadastro | Preservar |
| `clientes_historico` | D,C,U,S | pedido JOIN cliente, LEFT usuario | Pedido; Cliente ID; Cliente; Data; Status; Valor; Usuário | Preservar |
| `clientes_ranking` | D,C,U,S | pedido/cliente/usuario, GROUP BY cliente | Código; Cliente; Pedidos; Pedidos não cancelados; Faturamento | Preservar |
| `produtos_cadastro` | P | produto LEFT estoque | Código; Produto; Descrição; Ativo; Preço; Peso; Volume | Preservar |
| `produtos_precos` | P | produto LEFT estoque; preço atual | Código; Produto; Preço; Ativo | Preservar |
| `produtos_custos` | P | produto LEFT estoque; custo cadastrado atual | Código; Produto; Custo unitário atual; Ativo | Preservar |
| `produtos_estoque` | P | produto LEFT estoque; mínimo efetivo | Código; Produto; Ativo; Estoque atual; Mínimo individual; Mínimo aplicado; Localização | Melhorar: snapshot |
| `produtos_estoque_baixo` | P | produto LEFT estoque, atual < mínimo | Código; Produto; Ativo; Estoque atual; Mínimo individual; Mínimo aplicado; Localização | Melhorar: snapshot |
| `produtos_ranking` | D,C,P,U,S | pedido/item_pedido/produto/cliente/usuario, GROUP BY produto | Código; Produto; Unidades; Valor dos itens | Preservar |
| `estoque_movimentacoes` | D,P,U | movimentacao_estoque/produto/usuario | Movimento; Data; Tipo; Produto ID; Produto; Quantidade; Usuário ID; Usuário | Preservar |
| `estoque_entradas` | D,P,U | movimentacao_estoque, somente ENTRADA | Movimento; Data; Tipo; Produto ID; Produto; Quantidade; Usuário ID; Usuário | Preservar |
| `estoque_saidas` | D,P,U | movimentacao_estoque, somente SAIDA | Movimento; Data; Tipo; Produto ID; Produto; Quantidade; Usuário ID; Usuário | Preservar |
| `estoque_por_produto` | D,P,U | movimentacao_estoque/produto/usuario, GROUP BY produto | Código; Produto; Movimentos; Entradas; Saídas | Preservar |
| `pedidos_geral` | D,C,U,S | pedido/cliente/usuario | Pedido; Data; Cliente ID; Cliente; Status; Valor; Usuário ID; Usuário | Preservar |
| `pedidos_itens` | D,C,P,U,S | pedido/item_pedido/produto/cliente/usuario | Pedido; Data; Status; Cliente; Produto ID; Produto; Quantidade; Preço unitário; Subtotal | Preservar |
| `pedidos_status` | D,C,U,S | pedido/cliente/usuario, GROUP BY status | Status; Pedidos; Valor dos pedidos | Preservar |
| `pedidos_pendentes` | D,C,U,S | pedido/cliente/usuario, PENDENTE | Pedido; Data; Cliente ID; Cliente; Status; Valor; Usuário ID; Usuário | Preservar |
| `pedidos_andamento` | D,C,U,S | pedido/cliente/usuario, 4 status em andamento | Pedido; Data; Cliente ID; Cliente; Status; Valor; Usuário ID; Usuário | Preservar |
| `pedidos_concluidos` | D,C,U,S | pedido/cliente/usuario, ENTREGUE | Pedido; Data; Cliente ID; Cliente; Status; Valor; Usuário ID; Usuário | Preservar |
| `pedidos_cancelados` | D,C,U,S | pedido/cliente/usuario, CANCELADO | Pedido; Data; Cliente ID; Cliente; Status; Valor; Usuário ID; Usuário | Preservar |
| `vendas_periodo` | D,C,U,S | pedido/cliente/usuario, GROUP BY dia | Dia; Pedidos; Pedidos não cancelados; Faturamento | Preservar |
| `vendas_cliente` | D,C,U,S | pedido/cliente/usuario, GROUP BY cliente | Código; Cliente; Pedidos; Pedidos não cancelados; Faturamento | Preservar |
| `vendas_produto` | D,C,P,U,S | pedido/item_pedido/produto/cliente/usuario, GROUP BY produto | Código; Produto; Unidades; Valor dos itens | Preservar |
| `vendas_usuario` | D,C,U,S | pedido/cliente/usuario, GROUP BY usuário | Usuário ID; Usuário; Pedidos; Pedidos não cancelados; Faturamento | Preservar |
| `vendas_evolucao` | D,C,U,S | pedido/cliente/usuario, GROUP BY mês | Mês; Pedidos; Faturamento | Preservar |
| `indicadores_resumo` | D,C,U,S | pedido/cliente/usuario e subconsulta item_pedido | Pedidos; Pedidos não cancelados; Faturamento; Ticket médio; Unidades vendidas | Preservar |
| `indicadores_desempenho` | D,C,U,S | pedido/cliente/usuario, GROUP BY usuário | Usuário ID; Usuário; Pedidos; Pedidos não cancelados; Faturamento; Ticket médio | Preservar |
| `usuarios_cadastro` | D,U | usuario/perfil | Código; Usuário; E-mail; Cargo; Nível; Ativo; Acesso; Cadastro | Preservar |
| `usuarios_cargos` | — | perfil LEFT usuario LEFT perfil_pagina, COUNT DISTINCT | Código; Cargo; Descrição; Nível; Protegido; Usuários; Páginas autorizadas | Preservar |
| `usuarios_situacao` | D,U | usuario/perfil, GROUP BY cargo/acesso/ativo | Cargo; Acesso; Ativo; Usuários | Preservar |
| `usuarios_atividade` | D,U | log_sistema LEFT usuario | Log ID; Data; Usuário; E-mail; Ação; Entidade; Recurso; Resultado | Preservar |
| `auditoria_logs` | D,U | log_sistema LEFT usuario, corte por id_log na exportação | Log ID; Data; Usuário; E-mail; Ação; Entidade; Recurso; Resultado; IP; Evento ID; Request ID; Correlação; Sessão; Dispositivo; IP de origem; Método; Rota; HTTP status; Duração (ms) | Melhorar: 10 colunas aditivas |
| `entregas_registradas` | D,C,U,S | entrega/pedido/cliente, período por data_pedido | Entrega; Pedido; Cliente; Status; Saída; Entrega; Estimativa IA; Tempo real; Distância | Preservar |
| `auditoria_autenticacoes` | D,U | log_sistema LEFT usuario, ações de login, negação e revogação | Log ID; Data; Usuário; Evento; Resultado; Sessão; Request ID; IP | Expandir |
| `auditoria_alteracoes` | D,U | log_sistema LEFT usuario, changes_json presente, sem exportações | Log ID; Data; Usuário; Ação; Entidade; Recurso; Resultado; Mudanças sanitizadas; Request ID | Expandir |
| `auditoria_exportacoes` | D,U | log_sistema LEFT usuario, eventos EXPORTACAO_* | Log ID; Data; Usuário; Estado; Export ID; Resultado; Request ID; Sessão; Metadados sanitizados | Expandir |
| `auditoria_sessoes` | D,U | sessao_autenticacao JOIN usuario, por criada_em | Sessão; Usuário ID; Usuário; Criada em; Expira em; Revogada em; Motivo; Dispositivo | Expandir |

**Evidências para as decisões:** o catálogo histórico possui 35 IDs; A06 conserva essas consultas, acrescenta as 4 visões e amplia apenas `auditoria_logs`. As novas visões diferem por tipo de evidência: autenticação (acesso), alterações (diferenças persistidas), exportações (etapas correlacionadas) e sessões (ciclo de vida e revogação). Consultas executadas contra PostgreSQL precisam ser validadas em `RelatoriosIntegrationTest`, não se presume correção de joins só por compilação.

## Cálculos, dados ausentes e datas

- **Faturamento** = `SUM(pedido.valor_total)` com `status <> CANCELADO` (nulos de status tratados como não cancelados pela expressão herdada). **Ticket médio** = `AVG(valor_total)` dos pedidos não cancelados. Não equivalem a recebimento liquidado, lucro, margem ou receita reconhecida. `pedidos_geral`, `pedidos_cancelados`, `pedidos_status` e `clientes_historico` mostram valores **nominais**, inclusive cancelados, conforme a descrição. Não totalizar colunas nominais como se fossem faturamento.
- **Itens**: somas de unidades/valor de itens excluem cancelados nas visões de vendas e indicadores, exceto `status=CANCELADO` explícito nas visões especiais; `pedidos_itens` exibe cada item independente do status. `quantidade × preco_unitario` pode divergir do valor total do pedido.
- **Estoque baixo**: estritamente `quantidade_atual < mínimo`, somente quando há saldo cadastrado. A regra `EstoqueBaixoService` escolhe mínimo geral ou mínimo individual com fallback **10**. Nos relatórios que usam mínimo, a configuração é lida **uma vez por geração** para SQL e aba Informações, evitando informação divergente durante mudança concorrente de configuração. Não fornece snapshot transacional de todas as linhas do banco.
- **Status em andamento**: CONFIRMADO, EM_PREPARACAO, PRONTO ou legado EM_ANDAMENTO; concluído: ENTREGUE; pendente: PENDENTE; cancelado: CANCELADO. `clientes_sem_pedidos` significa ausência de pedido, não inatividade. Custos, preços, estoque e papéis refletem valores atuais, não séries históricas; logs de usuário não são aferição de produtividade.
- **Agregações e precisão**: SELECT/GROUP BY em PostgreSQL; totais XLSX são acumulados com `BigDecimal` no Java, apresentados como células numéricas do Excel (IEEE 754, sujeito a limites de precisão de apresentação). Nulos são células vazias; documentos, IDs UUID, referências, filtros e qualquer texto externo são gravados como STRING, sem interpretação de fórmulas. Campos muito longos são truncados ao limite de 32.767 caracteres do Excel. As consultas são parametrizadas; os únicos fragmentos SQL compostos no servidor vêm de IDs e regras internas tipadas.
- **Calendário/fuso**: `pedido.data_pedido`, `log_sistema.data_hora` e demais registros legados são PostgreSQL `TIMESTAMP WITHOUT TIME ZONE` — a zona de origem de históricos não é comprovada, logo não se inventa conversão retroativa. `sessao_autenticacao.criada_em` é `TIMESTAMPTZ`: filtro por dia usa meia-noite **UTC** e exibição via UTC. Assim, os mesmos filtros de dia civil podem não representar o mesmo fuso entre relatórios legados e sessões. Registrar o fuso adotado pela aplicação antes de uniformizar relatórios históricos.

## Rastreabilidade, estados e corte temporal

Cada exportação com execução iniciada tem UUID `exportId`, que une eventos em `log_sistema.entidade='RELATORIO'` e `recurso_id=exportId`. `request_id` e `correlation_id` são capturados da requisição; `session_ref`, `device_ref`, ator/perfil e IP são associados quando disponíveis. Filtros auditados são somente datas, IDs numéricos e status validado; nenhum token, cookie, senha, cabeçalho de autorização ou conteúdo de planilha deve ser persistido. Os detalhes incluem `registros`, `arquivoBytes`, `duracaoMs` e código de motivo quando aplicável.

| Evento | Resultado possível | Significado estrito |
| --- | --- | --- |
| `EXPORTACAO_SOLICITADA` | INICIADO | Autorizada e aceita para geração; ainda não há XLSX. |
| `EXPORTACAO_GERADA` | SUCESSO | XLSX escrito em arquivo temporário, ZIP central/tamanhos/CRC e componentes OOXML essenciais verificados; não houve transmissão. |
| `EXPORTACAO_TRANSMISSAO_ENCERRADA` | OBSERVADO | Escrita para o fluxo HTTP e `flush()` retornaram sem erro no servidor; **não** prova arquivo salvo, recebido integralmente, aberto ou lido no navegador. |
| `EXPORTACAO_FALHA` | FALHA ou NEGADO | Exceção na geração/transmissão ou capacidade simultânea excedida; desconexão pode ser observada como falha. |
| Ausência de evento terminal | DESCONHECIDO (inferência, não gravada) | Interrupção de processo, rejeição do executor, timeout ou falha do sistema de auditoria; investigar por exportId, sem inferir sucesso. |

Os eventos são persistidos em serviço separado, `@Transactional(REQUIRES_NEW)`, nunca no `@Transactional(readOnly=true)` da consulta/arquivo. O contexto é copiado **antes** do callback `StreamingResponseBody`. Para `auditoria_logs`, `usuarios_atividade`, `auditoria_autenticacoes`, `auditoria_alteracoes` e `auditoria_exportacoes`, a exportação congela `MAX(id_log)` antes do primeiro evento de exportação; SQL acrescenta `l.id_log <= corte`, evitando inclusão indefinida de suas próprias ações. A contagem não garante snapshot histórico serializável diante de outros eventos concorrentes com IDs menores ainda não confirmados.

**Início de cobertura:** a migration V9 adiciona campos de correlação, sem preenchimento retroativo. A V10 cria o histórico de sessões: não representa acessos anteriores à adoção da persistência. Exportações A06 só são auditadas desde sua ativação; dados anteriores **não são reconstruídos**. Não afirmar uma data de implantação sem evidência: determinar em cada instalação via primeiro evento persistido (`MIN(data_hora)` filtrando `event_id IS NOT NULL`, `acao LIKE 'EXPORTACAO_%'`) e `MIN(criada_em)` da tabela de sessões, ou registro auditado de implantação. Campos ausentes no legado aparecem vazios.

**Compatibilidade de colunas:** 35 IDs e URLs são mantidos. `auditoria_logs` preserva as primeiras **9 colunas** e acrescenta **10 no final**. Consumidores de posições 1–9 continuam compatíveis; leitores que exigem exatamente nove ou importam largura fixa precisam adaptar seu contrato. As 4 visões novas têm IDs próprios. As abas `Informações`, `Dados 1..N` e `Totais` continuam presentes, sem mudança da ordem das colunas preexistentes nos demais 34 relatórios.

## Desempenho, integridade e operação

`JdbcTemplate` usa `fetchSize=500` e PreparedStatements com parâmetros vinculados. `SXSSFWorkbook(100)`, `setCompressTempFiles(true)`, `dispose()` e `close()` limitam a janela de linhas e removem temporários internos do POI. O arquivo pertence a um spool privativo `/tmp/agerp-xlsx-spool`, com lock e recuperação restrita a órfãos reconhecidos; é removido no término observado da transmissão ou em falha. Planilhas com >1.048.575 linhas de dados são divididas em `Dados 2`, `Dados 3` etc., mantendo cabeçalhos; memória de totais limitada a colunas. Há semáforo de até **3 exportações simultâneas por processo**, cuja vaga é retida até o callback sair e liberar o spool, mesmo em timeout concorrente com envio bloqueado. Downloads lentos ocupam vagas, portanto instâncias e disco ainda exigem dimensionamento.

A validação pré-envio lê integralmente cada entrada ZIP, verifica tamanhos, CRC e existência de `[Content_Types].xml` e `xl/workbook.xml`. Essa validação vai além de Blob não vazio e assinatura PK, **mas não equivale** a abrir semanticamente o arquivo no Apache POI; testes fazem `WorkbookFactory.create` e devem continuar. Um arquivo no navegador pode falhar após essa etapa se a conexão for interrompida. Interrupção pós-cabeçalhos não permite substituir o XLSX por JSON.

**Time-out e Nginx (observação técnica de 25/10/2026):** a rota `/api/admin/relatorios/{id}/xlsx` usa `proxy_buffering off` e `proxy_read_timeout 300s`, conforme `agerp-frontend/nginx.conf` implantado no deploy de testes. Esse timeout se aplica ao intervalo entre leituras do upstream, não estabelece um limite total de 300 segundos para downloads e não substitui timeout do executor MVC. A geração XLSX ocorre antes de retornar cabeçalhos; se ela exceder os limites do servidor/proxy, a resposta poderá falhar antes da transmissão. O fluxo não é job durável. As lacunas de rejeição, morte abrupta e desconexão longa mencionadas nas seções cronológicas inferiores foram tratadas nos ensaios descritos no topo; o timeout HTTP real MVC segue não comprovado.

## Testes e critérios de aceite

Comandos de regressão: `mvn -o -q '-Dtest=RelatorioAdminServiceTest' test`; `mvn -o -q '-Dtest=RelatoriosIntegrationTest' test`; `mvn -o test`; `npm run build` no diretório `agerp-frontend`; `git diff --check`. Para integração, `TestcontainersConfiguration` sobe PostgreSQL 16 isolado e `@BeforeEach` executa TRUNCATE **somente no container**; nunca direcionar a testes para o banco real.

Casos implementados: consultas e contagem de colunas de todo catálogo com/sem filtros, validação de datas inclusive fim, dados vazios, exclusão de cancelados nos indicadores, totais Excel, strings literais e zeros à esquerda, abertura POI, JWT ADMIN/OPERADOR, `asyncDispatch`, correlação dos 3 eventos e snapshot de estoque. A cobertura de múltiplas abas >1 milhão, falha de socket real, timeout/cancelamento de executor e passagem física via Nginx depende de ambiente específico; não declarar aprovado sem execução. Comparar as contagens e somas relevantes com SQL diretamente no PostgreSQL de teste e reconfirmar todos os 39 downloads após cada mudança.

Histórico A06 (24/10/2026): compilação backend e build Vite concluídos com sucesso durante a implementação. A primeira execução de integração reproduziu falhas HTTP 500 na verificação pré-envio de ZIP; o verificador foi trocado por `ZipFile`/CRC. Foi identificada corrida entre os headers de `MockMvc` e a execução `StreamingResponseBody`; o teste agora aguarda `getAsyncResult` antes do redispatch e usa executor de teste com atraso controlado. Essa configuração se limita à suíte, sem modificar a execução HTTP de produção.

**Regressão final executada em 24/10/2026:** `RelatoriosIntegrationTest` = **9/9 aprovados**, incluindo 39 IDs exportados via HTTP com e sem filtros aplicáveis, abertura por Apache POI, eventos correlacionados e teste de corte de `auditoria_exportacoes` que exclui os próprios eventos. `com.agerp.agerp.RelatorioAdminServiceTest` = **2/2**, e `com.agerp.agerp.service.RelatorioAdminServiceTest` = **9/9**; portanto, **20/20 testes específicos de relatórios aprovados**. A suíte Maven completa executou **140 testes: 135 aprovados, 4 falhas e 1 erro**, sem falha nos testes A06. Falhas restantes: `CargosIntegrationTest` (201 esperado, 403 obtido), `ConfiguracaoSistemaIntegrationTest` (3 respostas 403 no lugar de 400/409) e `ClienteCrudCacheIntegrationTest` (`AccessDeniedException` por falta de ator no teste de auditoria de negócio). Essas ocorrências são de outras áreas e requerem triagem de autenticação/CSRF e contexto de auditoria antes de homologação geral; não se deve removê-las ou relaxar a segurança para forçar sucesso. Uma execução anterior teve falhas adicionais de startup por ausência do papel `aguser` no PostgreSQL isolado; a configuração de testes passou a criar papel **NOLOGIN**, sem alterar migrations nem bancos de produção.

**Complemento de regressão em 24/10/2026:** `AdminRelatorioExportControllerTest` = **2/2 aprovados** após a suíte geral acima. O teste injeta falha de geração antes de construir a resposta (HTTP 500 tratável como JSON pelo `GlobalExceptionHandler`) e simula `IOException` no fluxo de saída depois que o arquivo foi validado, exigindo evento `EXPORTACAO_FALHA` sem `EXPORTACAO_TRANSMISSAO_ENCERRADA`. Esses testes são unitários do controlador, **não** simulam desconexão de socket de um cliente real, headers efetivamente comprometidos no servidor ou passagem pelo proxy. Total de testes dirigidos à A06 verificados: **22/22**. O build de produção do frontend (`tsc -b && vite build`) também foi concluído com sucesso; restam avisos de tamanho de bundle e de desempenho dos plugins, sem erro de compilação.

**Ainda não validados fisicamente:** descarga e abertura após passagem pelo Nginx de teste; rompimento de socket/conexão real depois dos headers; falhas injetadas antes/depois do compromisso da resposta; rejeição/cancelamento/timeout do executor; recuperação automática de temporários órfãos; volume acima de 1.048.575 linhas que force múltiplas abas. São limites de homologação e não devem ser declarados como testes aprovados. Revisar timeout de proxy, tamanho máximo de disco e política de limpeza no ambiente de implantação, sem reiniciar sistemas reais.

## Comandos Git

Não executar `commit`, `push`, `pull`, `merge`, `rebase` ou `tag` automaticamente nesta tarefa. Inspecionar `git status` e `git diff`, selecionar **apenas os arquivos/hunks de A06** para staging, especialmente onde coexistam A02–A05. Depois de revisão, o responsável pode efetuar commit manual sem alterar branch.
