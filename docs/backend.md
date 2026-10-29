<!--
Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.
-->

# Backend

## Tecnologias atuais

O `pom.xml` do repositório registra:

- Java 25
- Spring Boot 4.1.0
- Maven
- Spring Security
- Spring Data JPA
- PostgreSQL Driver
- JWT JJWT 0.12.6
- Actuator
- Validation
- WebMVC
- WebFlux
- Kafka
- Caffeine
- Lombok
- Testcontainers

## Estrutura lógica

```text
src/main/java/com/agerp/agerp/
├── config/
├── controller/
├── dto/
├── entity/
├── repository/
├── security/
│   └── jwt/
├── service/
└── AgerpApplication.java
```

## Camadas

### Controller

Expõe os endpoints REST e recebe requisições do frontend.

### DTO

Define objetos de entrada e saída da API, evitando que entidades de persistência sejam usadas diretamente como contrato público.

Padrão esperado:

```text
CreateRequest
UpdateRequest
Response
```

### Entity

Representa as entidades persistidas no PostgreSQL através do JPA/Hibernate.

### Repository

Centraliza o acesso aos dados utilizando Spring Data JPA.

### Service

Concentra regras de negócio e orquestra chamadas a repositories e serviços externos.

### Security

Responsável por autenticação, autorização, JWT e integração com Spring Security.

## Dependências relevantes

- `spring-boot-starter-security`
- `spring-boot-starter-data-jpa`
- `spring-boot-starter-webmvc`
- `jjwt-api`
- `jjwt-impl`
- `jjwt-jackson`
- `postgresql`
- `spring-boot-starter-actuator`
- `spring-boot-starter-validation`

## Configuração

As credenciais e parâmetros de ambiente devem ser fornecidos por variáveis de ambiente e pelo `.env` local. O `.env.example` serve como referência sem expor segredos.

## Cache

O backend usa Spring Cache com Caffeine em memória. A configuração fica em `CacheConfig`, com um único `CacheManager` e caches registrados individualmente por `registerCustomCache()`.

Caches atuais:

| Cache | Uso | TTL | Tamanho máximo |
| --- | --- | --- | --- |
| `produtosAtivos` | `ProdutoService.listarAtivos()` | 5 minutos | 500 |
| `produtosTodos` | `ProdutoService.listarTodos()` | 5 minutos | 500 |
| `produtoPorId` | `ProdutoService.buscarPorId(id)` | 5 minutos | 1000 |
| `clientes` | `ClienteService.listarTodos()` | 5 minutos | 500 |
| `clientePorId` | `ClienteService.buscarPorId(id)` | 5 minutos | 1000 |
| `usuarios` | `UsuarioService.listarTodos()` | 3 minutos | 300 |
| `usuariosAtivos` | `UsuarioService.listarAtivos()` | 3 minutos | 300 |
| `usuarioPorId` | `UsuarioService.buscarPorId(id)` | 3 minutos | 500 |
| `usuarioPorEmail` | `UsuarioService.buscarPorEmail(email)` | 3 minutos | 500 |
| `pedidos` | `PedidoService.listarTodos()` | 2 minutos | 500 |
| `pedidoPorId` | `PedidoService.buscarPorId(id)` | 2 minutos | 1000 |
| `pedidosPorStatus` | `PedidoService.listarPorStatus(status)` | 1 minuto | 100 |
| `pedidosPorCliente` | `PedidoService.listarPorCliente(clienteId)` | 2 minutos | 500 |
| `pedidosPrevisaoIa` | `IaPrevisaoService.obterOuCalcularPrevisao(pedidoId)` | 10 minutos | 500 |
| `dashboardEstatisticas` | `DashboardService.getEstatisticasBasicas()` | 30 segundos | 10 |
| `dashboardRelatorio` | `DashboardService.gerarRelatorioCompleto()` | 30 segundos | 10 |
| `adminEstatisticas` | `AdminService.estatisticas()` | 30 segundos | 10 |
| `adminRelatorios` | `AdminService.relatorios()` | 1 minuto | 50 |

## Configuracoes administrativas (Flyway V6 e V8)

O registro unico `agerp.configuracao_sistema` (`id = 1`) guarda preferências nao sensiveis no PostgreSQL, com validacoes SQL e Bean Validation. A atualizacao usa `@Version` e exige a versao lida; edicoes concorrentes retornam HTTP `409` e requerem recarregamento.

| Campo | Padrao | Efeito real |
| --- | --- | --- |
| `nomeEmpresa` | `AGERP` | Titulo da navegacao autenticada via `/api/configuracoes/aparencia` |
| `limiteEstoqueBaixo` | `15` | Mínimo geral em unidades inteiras, aplicado a todos os produtos quando o modo geral está ativo |
| `usarEstoqueMinimoGeral` | `true` | `true`: usa o mínimo geral; `false`: usa o mínimo individual de cada produto; introduzido na V8 |
| `exibirAlertasEstoque` | `true` | Exibe ou oculta alertas visuais de estoque baixo; nao altera os dados nem as exportacoes |
| `timeoutIaMs` | `2000` | Timeout de conexao e leitura da previsao FastAPI; fallback heuristico se indisponivel |

`GET /api/admin/configuracoes`, `PUT /api/admin/configuracoes` e `GET /api/admin/configuracoes/diagnostico` exigem ADMIN. O `GET /api/configuracoes/aparencia` exige autenticacao, retornando somente campos de apresentacao. Cada alteracao registra campos alterados, autor e IP nos logs transacionais; nunca grava credenciais ou valores secretos. Os caches de dashboard, estatisticas e previsao sao invalidados apos o commit. A configuracao e lida do banco nas operacoes seguintes, sem depender de reinicio. Em uma futura implantacao com mais de uma instancia do backend, sera necessario coordenar a invalidacao dos caches Caffeine entre instancias.

**Estoque baixo (regra central `EstoqueBaixoService`):** um produto está com estoque baixo somente quando `quantidadeAtual < minimoAplicado`. Se `quantidadeAtual == minimoAplicado` não há alerta. O estoque é medido em unidades **inteiras**: mínimo geral de 1 a 100000; mínimo individual não negativo (zero desativa o alerta daquele produto no modo individual). Entradas JSON fracionárias para campos inteiros são rejeitadas com HTTP 400. Quantidade atual nula não entra nos indicadores de estoque baixo.

No modo individual, o estoque que veio de registros antigos com `quantidade_minima IS NULL` recebe **mínimo aplicado 10 apenas na leitura**, sem modificar a coluna no banco. A API de produtos expõe `quantidadeMinima` como valor original, `minimoAplicado` como limite efetivo, `estoqueBaixo` como booleano e `usarEstoqueMinimoGeral` como modo ativo. Alternar modos não modifica limites individuais nem o limite geral salvo. O dashboard mantém 10 itens no gráfico por legibilidade, porém o endpoint autenticado `GET /api/dashboard/estoque-baixo` retorna todos os itens e seus limites aplicados para a exportação XLSX. Dashboard, produtos e estatísticas ADMIN consultam a mesma regra de backend. Após salvar, os caches de produtos, dashboard, ADMIN e previsões são limpos após commit, e o frontend atualiza listagens e indicadores; os alertas visuais respeitam `exibirAlertasEstoque`.

A aba mostra estado resumido de PostgreSQL e FastAPI, versao de build quando existente e data da ultima alteracao; nao revela URL, segredos ou dados internos da infraestrutura. Aprovar novos cadastros e uma regra obrigatoria, nao um switch. Fuso/locale, JWT, politica de senhas e transicoes de pedido exigem decisoes e adaptacoes proprias; editar segredos, credenciais, conexoes e infraestrutura pela interface e proibido.

A invalidação fica na camada de Service. Escritas de produtos invalidam caches de produtos e de dashboard. Escritas de clientes invalidam caches de clientes e de dashboard. Escritas de usuários invalidam caches de usuários e estatísticas administrativas. Escritas e transições de status de pedidos (`PedidoService`) invalidam atomicamente caches de pedidos (`pedidos`, `pedidoPorId`, `pedidosPorStatus`, `pedidosPorCliente`, `pedidosPrevisaoIa`), estoques/produtos e indicadores de dashboard. Logs administrativos, autenticação e health check não usam Caffeine.

## Módulo de Pedidos e IA
- `PedidoService`: Regras transacionais de criação, cancelamento e transições de status com controle e auditoria de estoque.
- `IaPrevisaoService`: Cliente HTTP para o microsserviço Python (`services/python-ia`), fornecendo previsão inteligente de tempo de entrega com fallback determinístico. Consulte `docs/pedidos.md` para a especificação detalhada.

O `CacheHeaderFilter` trata apenas headers HTTP (`Cache-Control`) enviados ao cliente. Isso é independente do cache Caffeine interno do backend.

## Gerenciamento de cargos (V7)

As APIs abaixo exigem `ROLE_ADMIN`, no servidor:

| Método | Endpoint | Resultado |
| --- | --- | --- |
| GET | `/api/admin/perfis` | Lista cargos, níveis, páginas e versões |
| POST | `/api/admin/perfis` | Cria cargo personalizado (HTTP 201) |
| PUT | `/api/admin/perfis/{id}` | Atualiza cargo (requer `versao`) |
| DELETE | `/api/admin/perfis/{id}` | Remove cargo sem usuários vinculados (HTTP 204) |
| PUT | `/api/admin/usuarios/{id}` | Atualiza atribuição de cargo, com proteção do último ADMIN |

Payload de exemplo: `{"nome":"EXPEDICAO","descricao":"Logística","nivelAutoridade":40,"paginas":["PEDIDOS"],"versao":0}`.
Em criação, omitir `versao`. A tentativa de editar/excluir ADMIN ou excluir
OPERADOR retorna 403; excluir cargo com usuários ou editar com versão antiga
retorna 409. Nomes e páginas reservados são recusados. A camada de serviço
também valida essas invariantes.

`PAGE_*` é validado pelo Spring Security em `/api/dashboard/**`,
`/api/clientes/**` (inclusive endereços), `/api/produtos/**` e `/api/pedidos/**`.
Excluir logicamente produto (`DELETE /api/produtos/{id}`) e cancelar pedido
(`POST /api/pedidos/{id}/cancelar` ou `PATCH /api/pedidos/{id}/status?status=CANCELADO`)
exige simultaneamente permissão da página e nível >= 60. Excluir pedido
(`DELETE /api/pedidos/{id}`) permanece exclusivo do ADMIN.

## Observações

O `pom.xml` atual possui algumas dependências que devem ser revisadas conforme a evolução do projeto, principalmente quando um recurso deixar de ser utilizado. Evitar adicionar dependências sem necessidade.
## Auditoria de operações de negócio (A04)

Consulte [a matriz de cobertura e campos excluídos](auditoria-negocio.md). A instrumentação A04 está **parcial**; a matriz identifica explicitamente o que falta antes do aceite completo.
## Consulta avançada de auditoria (A05)

`GET /api/admin/logs` continua restrito a ADMIN no servidor. Parâmetros opcionais:
`email`, `perfil`, `acao`, `resultado`, `entidade`, `recursoId`, `sessionRef`,
`requestId` (UUID), `ip`, `search`, `fields`, `inicio` e `fim` (ISO-8601 com fuso),
`page`, `size`, `sortBy`, `direction`. O período é inclusivo nas duas extremidades;
intervalo invertido e UUID inválido retornam 400. A busca textual é OR entre
`fields` (email, perfil, acao, entidade, ip); filtros estruturados são AND.
`sortBy` é restrito a dataHora, acao, entidade ou id, com desempate por id;
o tamanho máximo é 100. As respostas mantêm Page e acrescentam metadados
de origem/sessão/requisição e `changesJson`, quando registrados. `detalhes`
livre legado é suprimido na API para não expor possíveis segredos históricos.
Snapshots ausentes não são preenchidos com dados atuais do cadastro.

Exemplos: `/api/admin/logs?entidade=PEDIDO&recursoId=42&page=0&size=20`;
`/api/admin/logs?sessionRef=<referencia>&page=1&size=20`;
`/api/admin/logs?requestId=<uuid>&resultado=SUCESSO`.
Não há consulta ilimitada; páginas usam OFFSET/LIMIT e contagem, com potencial
custo crescente em offsets profundos. Considerar keyset `(dataHora,id)` quando
medições em volume real o justificarem. Nenhum índice adicional foi criado sem
plano de execução ou evidência de necessidade; os índices da migração A03 foram
preservados. Não deduzir identificação física por IP, UA ou dispositivo lógico.
