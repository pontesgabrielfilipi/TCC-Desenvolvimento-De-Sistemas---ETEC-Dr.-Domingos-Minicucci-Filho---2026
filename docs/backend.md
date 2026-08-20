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

## Observações

O `pom.xml` atual possui algumas dependências que devem ser revisadas conforme a evolução do projeto, principalmente quando um recurso deixar de ser utilizado. Evitar adicionar dependências sem necessidade.
