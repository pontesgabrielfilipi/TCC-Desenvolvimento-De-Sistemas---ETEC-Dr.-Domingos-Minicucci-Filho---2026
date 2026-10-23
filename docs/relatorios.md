# Admin → Relatórios (XLSX)

## Acesso e execução

A central fica em **Admin → Relatórios**. O catálogo vem de `GET /api/admin/relatorios`; cada relatório é baixado em `GET /api/admin/relatorios/{id}/xlsx`. Todos os endpoints exigem **ROLE_ADMIN** tanto na configuração HTTP (`/api/admin/**`) quanto no controlador (`@PreAuthorize`). As escolhas de cargo/perfil e permissões de páginas são lidas das tabelas `perfil` e `perfil_pagina` (migration V7). Um usuário sem o papel ADMIN não pode consultar o catálogo nem exportar, mesmo que tenha acesso a outras páginas.

Os parâmetros opcionais, conforme a disponibilidade publicada no catálogo, são `inicio`, `fim` (`YYYY-MM-DD`, inclusivo), `clienteId`, `produtoId`, `usuarioId` e `status` do pedido. Filtros não aplicáveis **não** afetam o relatório; o frontend envia apenas os filtros anunciados. Datas de cadastro e de movimentação são filtradas pelo próprio campo da entidade. O histórico de pedido usa `pedido.data_pedido`.

## Relatórios disponíveis

| Grupo | Relatórios (IDs) |
| --- | --- |
| Clientes | `clientes_cadastro`, `clientes_tipo`, `clientes_sem_pedidos`, `clientes_historico`, `clientes_ranking` |
| Produtos | `produtos_cadastro`, `produtos_precos`, `produtos_custos`, `produtos_estoque`, `produtos_estoque_baixo`, `produtos_ranking` |
| Estoque | `estoque_movimentacoes`, `estoque_entradas`, `estoque_saidas`, `estoque_por_produto` |
| Pedidos | `pedidos_geral`, `pedidos_itens`, `pedidos_status`, `pedidos_pendentes`, `pedidos_andamento`, `pedidos_concluidos`, `pedidos_cancelados` |
| Vendas | `vendas_periodo`, `vendas_cliente`, `vendas_produto`, `vendas_usuario`, `vendas_evolucao` |
| Indicadores | `indicadores_resumo`, `indicadores_desempenho` |
| Usuários | `usuarios_cadastro`, `usuarios_cargos`, `usuarios_situacao`, `usuarios_atividade` |
| Auditoria | `auditoria_logs` |
| Logística | `entregas_registradas` |

### Regras de negócio

- **Faturamento** = soma de `pedido.valor_total` dos pedidos cujo status não é `CANCELADO`. **Ticket médio** = média de `valor_total` dos pedidos não cancelados (não é valor recebido, lucro nem receita contábil reconhecida). O sistema não possui dados suficientes para calcular lucro ou recebimentos conciliados e esses campos não são anunciados como indicadores.
- Quantidade/valor dos itens = soma dos itens associados aos pedidos não cancelados, exceto quando `CANCELADO` é escolhido explicitamente como filtro, reproduzindo a regra dos indicadores administrativos. O valor de itens (`quantidade × preco_unitario`) não deve ser confundido com o total do pedido ou com pagamento.
- Status em andamento: `CONFIRMADO`, `EM_PREPARACAO`, `PRONTO` ou status legado `EM_ANDAMENTO`; concluído = `ENTREGUE`; pendente = `PENDENTE`; cancelado = `CANCELADO`.
- **Estoque baixo**: `quantidade_atual < mínimo aplicado`, estritamente. A regra vem da configuração atual (`EstoqueBaixoService`): mínimo geral para todos os produtos, ou mínimo individual com fallback de 10 quando estiver ausente. Estoque ausente/sem saldo informado não é equiparado a zero.
- A tabela de clientes não possui um campo de situação ativo/inativo. Por isso, **clientes sem pedidos** são identificados objetivamente, sem classificar automaticamente como inativo quem comprou há muito tempo. O ranking de clientes agrupa clientes com pedidos; clientes sem nenhum pedido ficam no relatório específico. Os relatórios de preços e de custos unitários mostram valores **atuais cadastrados**, não histórico de alterações nem custos efetivos históricos das vendas. A atividade de usuários corresponde aos logs efetivamente registrados; não mede produtividade ou tempo de trabalho.
- Entregas: o relatório usa os dados **persistidos** de entrega. Não é um painel de previsões futuras ou desempenho do modelo de ML. Pagamentos, custos e previsão de entrega não foram incluídos como métricas financeiras porque não existe lógica de conciliação financeira nem garantia de consistência disponível para essa finalidade.

### Formato do arquivo

O servidor executa SQL parametrizado (não usa as páginas da interface), obtendo todos os registros correspondentes aos filtros. `JdbcTemplate` lê por cursor com `fetchSize=500` e o `SXSSFWorkbook` escreve as linhas com uma janela de 100 registros em memória. Ao exceder o limite de linhas do Excel, é aberta nova aba `Dados N`. São geradas também abas `Informações` (nome, categoria, filtros, data de geração, regra de cálculo e número de registros) e `Totais` (somas de colunas quando aplicáveis). As abas de dados têm cabeçalho, autofiltro e primeira linha congelada. Valores numéricos e datas são gravados em tipos próprios com máscara brasileira; documento/telefone e textos de cadastros são gravados como **STRING**, inclusive quando começam com `=` ou zeros.

Para evitar consumo excessivo de memória, o download é transmitido com `StreamingResponseBody`; em arquivos grandes a montagem pode demorar, utiliza arquivos temporários e demanda espaço em disco no servidor. A geração não é um job de background: se o cliente desconectar, a exportação pode ser interrompida. Somente dados persistidos e visíveis no momento da consulta são exportados; não há histórico temporal de preço, saldo, cargo ou configuração para reconstrução de períodos anteriores.

## Validação

- `mvn -q -Dtest=RelatorioAdminServiceTest test`: testes unitários de catálogo, filtros e parâmetros, regra de estoque, criação e abertura de XLSX via Apache POI, tipos de células, zeros à esquerda, texto não convertido em fórmula, somatórios e arquivos vazios.
- `npm run build` em `agerp-frontend`: checa TypeScript e empacotamento da nova interface.
- `mvn -q -Dtest=RelatoriosIntegrationTest test`: valida todas as 35 consultas com e sem filtros combinados contra PostgreSQL 16 via Testcontainers, com migrations V1–V8, além dos filtros de período, total de faturamento e permissões de acesso.
- `mvn test`: executa a suíte completa do backend. Requer Docker disponível para os testes de integração.
