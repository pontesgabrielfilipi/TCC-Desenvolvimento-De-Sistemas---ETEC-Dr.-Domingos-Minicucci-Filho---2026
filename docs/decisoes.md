# Decisões Técnicas

## 1. Arquitetura baseada em API REST

**Status:** adotada.

O frontend não acessa diretamente o banco de dados. A comunicação ocorre através da API Spring Boot.

## 2. Separação frontend/backend

**Status:** adotada.

O frontend React é mantido separado do backend Java, permitindo evolução independente das camadas.

## 3. PostgreSQL

**Status:** adotada.

PostgreSQL é utilizado como banco relacional principal.

## 4. JWT com HttpOnly Cookie

**Status:** adotada.

O projeto utiliza JWT com armazenamento em cookie HttpOnly como estratégia de autenticação.

## 5. RBAC

**Status:** adotada.

A autorização é organizada por perfis de usuário:

- ADMIN
- GERENTE
- OPERADOR
- FINANCEIRO

**Atualização (Flyway V7):** cada cargo possui permissões de páginas explícitas e
um nível de autoridade. Os perfis anteriores foram preservados, e o administrador
mantém a identidade reservada `ADMIN` (nível 100). `OPERADOR` também é um cargo
reservado, porém suas permissões e seu nível (1–99) podem ser editados pelo ADMIN.
Os dois cargos não podem ser excluídos nem renomeados.

**Regra única de autorização:** abrir um módulo exige sempre sua permissão
`PAGE_DASHBOARD`, `PAGE_CLIENTES`, `PAGE_PRODUTOS` ou `PAGE_PEDIDOS`. O nível,
isoladamente, não autoriza abrir páginas e não herda permissões de níveis
inferiores. Operações privilegiadas exigem **permissão de página E nível mínimo
60**: exclusão lógica de produto e cancelamento de pedido (inclusive pela mudança
de status). Cargos personalizados ficam entre 1–99; apenas o ADMIN de nível 100
acessa `/api/admin/**`, gerencia usuários/cargos e exclui pedidos pelo endpoint
administrativo de exclusão lógica. ADMIN possui todas as páginas.

**Administração e sessão:** a concessão de cargos é restrita a ADMIN, com
verificação de hierarquia no servidor; não é possível criar ou atribuir um cargo
acima do próprio nível. Não é permitido bloquear/rebaixar o último ADMIN
aprovado. Mudanças em permissões de um cargo existente são refletidas na próxima
requisição autenticada, pois o filtro JWT recarrega o usuário e suas autoridades
do banco; trocas de cargo de um usuário invalidam seu token por `credentialVersion`.

## 6. Docker Compose

**Status:** adotada.

Os componentes da aplicação são orquestrados por Docker Compose para padronizar o ambiente.

## 7. Microsserviço separado para Machine Learning

**Status:** adotada.

O modelo preditivo é isolado em serviço Python/FastAPI, evitando acoplamento direto do modelo ao código Java.

## 8. DTOs

**Status:** adotada como padrão de projeto.

Sempre que adequado, separar DTOs de criação, atualização e resposta.

## 9. Versões atuais do projeto

O material acadêmico inicial citava Spring Boot 3 e React 18. O repositório atual apresenta:

- Java 25
- Spring Boot 4.1.0
- React 19.2.x
- Vite 8

**Decisão:** a documentação técnica deve acompanhar o estado real do repositório; o texto do TCC deve ser sincronizado antes da versão final.

## 10. Fonte de verdade

**Status:** adotada.

- Código/configuração: repositório.
- Decisões: `docs/decisoes.md`.
- Estado: `docs/tarefas.md`.
- Problemas: `docs/problemas.md`.
- Conteúdo acadêmico: `docs/tcc/`.

## 11. Cache interno com Caffeine

**Status:** adotada.

O backend usa Spring Cache com Caffeine para cache interno de leituras frequentes. Cada cache possui TTL previsível com `expireAfterWrite()` e tamanho máximo próprio.

O cache Caffeine é aplicado na camada de Service, não em Controllers. Operações de escrita não são cacheadas; elas invalidam os caches relacionados via `@CacheEvict` e `@Caching`.

`Cache-Control` HTTP continua separado do cache interno. Endpoints sensíveis como autenticação, health check, produtos e logs administrativos não devem ser tratados como cache HTTP público.

## 12. Módulo de Pedidos

**Status:** implementado.

O módulo de Pedidos foi implementado seguindo estritamente a arquitetura existente do AGERP:

- **Entidades JPA**: `Pedido` e `ItemPedido` (já existentes no schema `agerp`), mapeadas com Hibernate.
- **DTOs**: `PedidoCreateRequest`, `PedidoUpdateRequest`, `PedidoResponse`, `ItemPedidoRequest`, `ItemPedidoResponse`, `PrevisaoEntregaResponse`.
- **Repositórios**: `PedidoRepository` e `ItemPedidoRepository` com Spring Data JPA.
- **Serviço**: `PedidoService` concentra toda a regra de negócio — cálculo de total no backend, validação de estoque, controle transacional, máquina de estados de status e auditoria de movimentações.
- **Controller**: `PedidoController` com endpoints REST protegidos pelo `SecurityConfig` existente.
- **Cache**: 5 caches Caffeine registrados em `CacheConfig` com invalidação cruzada em escrita.
- **IA**: `IaPrevisaoService` integrado ao microsserviço `services/python-ia` via `POST /predict`, com fallback determinístico.
- **Frontend**: `Pedidos.tsx` com Sidebar preservado, `pedidoService.ts` centralizado, tipos TypeScript, `formatCurrency` seguro e painel de previsão de entrega por IA.

**Decisão crítica sobre estoque**: O estoque é debitado exclusivamente na transição de status `PENDENTE → CONFIRMADO`. Cancelamentos de pedidos `CONFIRMADO`, `EM_PREPARACAO` ou `PRONTO` estornam o estoque com `ENTRADA` auditada. Cancelamento de pedido ainda `PENDENTE` não gera movimentação (nunca houve débito). A operação é idempotente para a mesma transição de status.

## 13. Estoque mínimo geral e individual

**Status:** implementado (Flyway V8). A opção administrativa `Usar estoque mínimo geral` inicia ligada para manter o limite de 15 unidades utilizado anteriormente. Desligada, aplica-se `estoque.quantidade_minima` por produto; os mínimos individuais nunca são sobrescritos ao alternar. A fonte única é `EstoqueBaixoService`, usada por produtos, indicadores, gráficos, alertas e exportações. O critério é `atual < mínimo`, não `<=`; quantidades são inteiras, mínimo geral 1–100000 e individual >= 0. Registros históricos com mínimo individual `NULL` adotam 10 somente no cálculo; estoque atual `NULL` não gera alerta. O dashboard resume os dez primeiros itens no gráfico, mas a exportação consulta todos via `/api/dashboard/estoque-baixo`. Configuração e limite geral persistem no banco; mudanças invalidam caches após commit e notificam telas abertas na aplicação.
