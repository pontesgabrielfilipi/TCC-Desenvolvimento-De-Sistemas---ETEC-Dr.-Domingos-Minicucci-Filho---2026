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
| `dashboardEstatisticas` | `DashboardService.getEstatisticasBasicas()` | 30 segundos | 10 |
| `dashboardRelatorio` | `DashboardService.gerarRelatorioCompleto()` | 30 segundos | 10 |
| `adminEstatisticas` | `AdminService.estatisticas()` | 30 segundos | 10 |
| `adminRelatorios` | `AdminService.relatorios()` | 1 minuto | 50 |
| `adminConfiguracoes` | `AdminService.configuracoes()` | 10 minutos | 20 |

A invalidação fica na camada de Service. Escritas de produtos invalidam caches de produtos e de dashboard. Escritas de clientes invalidam caches de clientes e de dashboard. Escritas de usuários invalidam caches de usuários e estatísticas administrativas. Logs administrativos, autenticação e health check não usam Caffeine.

O `CacheHeaderFilter` trata apenas headers HTTP (`Cache-Control`) enviados ao cliente. Isso é independente do cache Caffeine interno do backend.

## Observações

O `pom.xml` atual possui algumas dependências que devem ser revisadas conforme a evolução do projeto, principalmente quando um recurso deixar de ser utilizado. Evitar adicionar dependências sem necessidade.
