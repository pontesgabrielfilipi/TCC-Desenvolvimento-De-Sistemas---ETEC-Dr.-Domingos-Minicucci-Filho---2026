<!--
Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.
-->

# Referências de desenvolvimento do backend

Este arquivo substitui as orientações genéricas geradas pelo Spring Initializr. O backend AGERP utiliza **Java 25**, **Spring Boot 4.1.0**, **Maven**, **Spring Security**, **JPA**, **Flyway** e **PostgreSQL 16**; consulte o [`pom.xml`](pom.xml) para a lista exata de dependências.

## Como começar

As configurações de conexão e segurança variam conforme o ambiente. Consulte o [README principal](README.md), [Backend](docs/backend.md) e [Configuração por ambiente](docs/configuracao-ambientes.md). O banco utilizado pelo Compose é a imagem `postgres:16`, definida em [`docker-compose.yml`](docker-compose.yml).

Após configurar as variáveis e os serviços necessários, o backend pode ser iniciado com:

```powershell
mvn spring-boot:run
```

Os testes Java são executados pelo Maven, e parte da suíte de integração utiliza Testcontainers com Docker. Esses testes podem exigir variáveis ou serviços configurados; não execute migrations de produção manualmente como substituto dos testes.

## Documentação de referência

- [Apache Maven](https://maven.apache.org/guides/index.html)
- [Spring Boot](https://docs.spring.io/spring-boot/reference/)
- [Spring Security](https://docs.spring.io/spring-security/reference/)
- [Spring Data JPA](https://docs.spring.io/spring-data/jpa/reference/)
- [Testcontainers para PostgreSQL](https://java.testcontainers.org/modules/databases/postgres/)
- [Flyway](https://documentation.red-gate.com/fd)

## Metadados do Maven

O `pom.xml` contém seções vazias `licenses` e `developers` para não herdar automaticamente metadados do projeto-pai. O licenciamento do código próprio do AGERP é descrito no [LICENSE](LICENSE); componentes de terceiros preservam suas próprias licenças.
