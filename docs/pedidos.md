# Módulo de Pedidos (AGERP)

## 1. Visão Geral

O módulo de Pedidos do AGERP gerencia todo o ciclo de vida de vendas e solicitações comerciais, integrando clientes, produtos, controle transacional de estoque com idempotência, cache Caffeine de alto desempenho e previsões inteligentes de entrega através de Machine Learning via microsserviço Python.

---

## 2. Modelo de Dados

O módulo utiliza as tabelas relacionais no schema `agerp` do PostgreSQL 16:

### Tabela `agerp.pedido`
| Coluna | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| `id_pedido` | `BIGSERIAL` | `PRIMARY KEY` | Identificador único do pedido |
| `id_cliente` | `BIGINT` | `NOT NULL`, `FK -> agerp.cliente` | Cliente solicitante |
| `data_pedido` | `TIMESTAMP` | `NOT NULL` | Data/hora de abertura do pedido |
| `status` | `VARCHAR(30)` | `NOT NULL` | Estado do pedido (`PENDENTE`, `CONFIRMADO`, etc.) |
| `valor_total` | `NUMERIC(12,2)` | `NOT NULL` | Valor total consolidado pelo backend |
| `id_usuario` | `BIGINT` | `FK -> agerp.usuario` | Operador/usuário responsável |

### Tabela `agerp.item_pedido`
| Coluna | Tipo | Restrições | Descrição |
| --- | --- | --- | --- |
| `id_item` | `BIGSERIAL` | `PRIMARY KEY` | Identificador único do item |
| `id_pedido` | `BIGINT` | `NOT NULL`, `FK -> agerp.pedido` | Pedido ao qual pertence |
| `id_produto` | `BIGINT` | `NOT NULL`, `FK -> agerp.produto` | Produto referenciado |
| `quantidade` | `INTEGER` | `NOT NULL`, `CHECK (> 0)` | Quantidade solicitada |
| `preco_unitario` | `NUMERIC(10,2)` | `NOT NULL` | Preço histórico congelado no momento da venda |

### Integrações Relacionadas
- `agerp.estoque`: Controle de saldo disponível por produto (`quantidade_atual`).
- `agerp.movimentacao_estoque`: Log auditável de saídas (`SAIDA`) e retornos por cancelamento (`ENTRADA`).
- `agerp.entrega`: Registro da remessa e previsão calculada.
- `agerp.previsao_entrega`: Armazenamento analítico dos parâmetros da IA (tempo estimado, faixa mín/máx, versão do modelo).

---

## 3. Máquina de Estados e Transições de Status

A máquina de estados implementada em `PedidoService` é rigorosa e não permite saltos de transição inconsistentes:

```
[ PENDENTE ] ──────────────► [ CONFIRMADO ] ──────────────► [ EM_PREPARACAO ]
      │                            │                               │
      │                            ▼                               ▼
      │                      [ CANCELADO ]                   [ CANCELADO ]
      │                   (Estorna Estoque)               (Estorna Estoque)
      ▼                                                            │
[ CANCELADO ]                                                      ▼
(Sem estorno)                                                  [ PRONTO ]
                                                                   │
                                                                   ▼
                                                              [ ENTREGUE ]
```

### Regras de Transição:
1. **PENDENTE**: Pedido criado com itens válidos e preços fixados. O estoque foi checado mas ainda não debitado.
2. **CONFIRMADO**: Dispara a baixa de estoque (`SAIDA`) com registro em `movimentacao_estoque`.
3. **EM_PREPARACAO**: Pedido em separação ou montagem na logística.
4. **PRONTO**: Pedido pronto para faturamento e despacho de entrega.
5. **ENTREGUE**: Pedido finalizado com sucesso. Nenhuma transição subsequente é permitida.
6. **CANCELADO**:
   - Se o status anterior era `CONFIRMADO`, `EM_PREPARACAO` ou `PRONTO`: o estoque é estornado (`ENTRADA`) e auditado em `movimentacao_estoque`.
   - Se o status anterior era `PENDENTE`: o pedido é cancelado sem alteração de estoque (pois não havia sido debitado).
   - Um pedido já `ENTREGUE` **NÃO** pode ser cancelado via API padrão.
7. **Idempotência**: Se for requisitado o mesmo status em que o pedido já se encontra (ex: `CONFIRMADO` -> `CONFIRMADO`), a operação é idempotente (ignora sem duplicar baixas de estoque).

---

## 4. Controle Transacional e Regras de Estoque

Toda a lógica de persistência e movimentação é encapsulada em transações com `@Transactional`:

- **Cálculo no Backend**: O frontend apenas sugere itens e quantidades. O backend obtém o preço atual do produto do banco de dados, congela em `item_pedido.preco_unitario`, calcula `subtotal = quantidade * preco_unitario` e define `valor_total = sum(subtotais)`.
- **Validação de Estoque**: Nenhum pedido pode ser criado se a quantidade solicitada exceder `estoque.quantidade_atual`.
- **Prevenção de Dupla Baixa**: O débito ocorre estritamente na transição para `CONFIRMADO` com verificação de status prévio.
- **Auditoria de Movimentação**: Cada saída ou retorno gera um registro em `movimentacao_estoque` vinculado ao produto e à data.

---

## 5. Endpoints REST da API

Todos os endpoints operam em `/api/pedidos` e são protegidos por Spring Security:

| Método | Endpoint | Permissões | Descrição |
| --- | --- | --- | --- |
| `GET` | `/api/pedidos` | Autenticado | Lista todos os pedidos cadastrados (cacheado) |
| `GET` | `/api/pedidos/{id}` | Autenticado | Retorna detalhes completos do pedido e itens |
| `GET` | `/api/pedidos/cliente/{clienteId}` | Autenticado | Filtra pedidos por cliente |
| `GET` | `/api/pedidos/status/{status}` | Autenticado | Filtra pedidos pelo status informado |
| `GET` | `/api/pedidos/{id}/previsao-entrega` | Autenticado | Obtém ou calcula previsão de entrega via IA |
| `POST` | `/api/pedidos` | Autenticado | Cria um novo pedido e valida itens e estoque |
| `PUT` | `/api/pedidos/{id}` | Autenticado | Atualiza itens de pedido pendente |
| `PATCH`| `/api/pedidos/{id}/status` | Autenticado | Executa transição de status com regras de estoque |
| `DELETE`| `/api/pedidos/{id}` | `ADMIN`, `GERENTE` | Remove pedido ou estorna caso confirmado |

---

## 6. Estratégia de Cache (Caffeine)

O módulo utiliza o `CacheManager` existente em `CacheConfig.java` com TTLs dedicados:

- `pedidos`: TTL 2 minutos, capacidade 500 registros.
- `pedidoPorId`: TTL 2 minutos, capacidade 1000 registros.
- `pedidosPorStatus`: TTL 1 minuto, capacidade 100 registros.
- `pedidosPorCliente`: TTL 2 minutos, capacidade 500 registros.
- `pedidosPrevisaoIa`: TTL 10 minutos, capacidade 500 registros.

**Invalidação Automática**:
Operações de escrita (`criar`, `atualizar`, `alterarStatus`, `deletar`) utilizam `@Caching` para invalidar atomicamente:
- Caches de pedidos (`pedidos`, `pedidoPorId`, `pedidosPorStatus`, `pedidosPorCliente`, `pedidosPrevisaoIa`).
- Caches de estoque e produtos (`produtosAtivos`, `produtosTodos`, `produtoPorId`).
- Caches do dashboard (`dashboardEstatisticas`, `dashboardRelatorio`, `adminEstatisticas`).

---

## 7. Integração com Microsserviço de IA

O AGERP integra previsões de entrega alimentadas pelo modelo Random Forest treinado em `services/python-ia`:

1. **Chamada REST**: O `IaPrevisaoService.java` efetua requisição `POST http://localhost:8000/predict` enviando peso dos itens, volume cúbico, distância calculada até o cliente e localização.
2. **Resposta da IA**: O microsserviço retorna `tempo_estimado_dias`, `tempo_minimo_dias`, `tempo_maximo_dias`, `nivel_confianca` e `versao_modelo`.
3. **Resiliência e Fallback**: Caso o microsserviço Python esteja temporariamente indisponível, o `IaPrevisaoService` aplica um algoritmo determinístico de fallback baseado no peso e distância padrão para não interromper a operação comercial.
4. **Persistência Logística**: A previsão é automaticamente armazenada nas tabelas `entrega` e `previsao_entrega`.

---

## 8. Frontend React & TypeScript

A interface do usuário foi construída em `agerp-frontend/src/pages/pedidos/Pedidos.tsx`:

- **Design System e Sidebar**: O Sidebar corporativo, o Header e o tema de cores foram rigorosamente preservados, mantendo paridade com `Produtos.tsx` e `Clientes.tsx`.
- **Prevenção de Falhas Numéricas**: Todas as exibições monetárias utilizam `formatCurrency()` seguro de `formatters.ts`, eliminando riscos de exceções do tipo `Cannot read properties of null (reading 'toFixed')`.
- **Listagem e Filtros Dinâmicos**: Busca textual por nome do cliente ou ID, filtro rápido por status com contadores em tempo real.
- **Modal de Novo Pedido**: Adição dinâmica de múltiplos itens com cálculo interativo de subtotais e validação de quantidade.
- **Seletor de produtos**: exibe código (ID), nome, preço e `quantidadeAtual` retornada por `GET /api/produtos`, inclusive estoque `0`. A ausência de registro/saldo é representada como `null` e exibida como “Estoque: não informado”. Exibe unidade de medida quando a API a disponibilizar. A listagem de produtos carrega saldos em lote e é atualizada ao abrir o modal, sem chamada HTTP por item. O `<select>` nativo mantém navegação por teclado; o detalhamento abaixo exibe o nome completo em telas estreitas. Esta informação é somente de leitura: regras de validação e reserva/baixa permanecem no `PedidoService`.
- **Modal de Detalhes e Painel de IA**: Visualização detalhada dos itens com acionamento do botão *"Consultar Previsão de Entrega (IA)"*, exibindo prazo central, intervalo de confiança e detalhes do algoritmo.
- **Modal de Cancelamento**: Confirmação visual obrigatória destacando o estorno de estoque quando aplicável.
