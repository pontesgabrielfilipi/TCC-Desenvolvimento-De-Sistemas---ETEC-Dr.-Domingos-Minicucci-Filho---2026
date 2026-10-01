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
