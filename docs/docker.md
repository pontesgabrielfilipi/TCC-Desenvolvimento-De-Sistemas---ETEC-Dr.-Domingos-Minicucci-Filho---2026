# Docker

## Serviços atuais

O `docker-compose.yml` atual define:

```text
postgres
python-ia-api
backend-api
frontend
```

## PostgreSQL

```text
Imagem: postgres:16
Container: agerp-postgres
```

Possui:
- volume `pgdata`;
- healthcheck com `pg_isready`;
- rede `agnet`;
- inicialização por `docker/postgres/init`.

## Microsserviço Python

```text
Container: agerp-python
Porta interna: 8000
```

O serviço é construído a partir de:

```text
services/python-ia/Dockerfile
```

Configurações previstas:
- `APP_HOST=0.0.0.0`
- `APP_PORT=8000`
- `APP_WORKERS=2`
- `APP_RELOAD=false`

Healthcheck:

```text
GET /health
```

## Backend

```text
Container: agerp-app
Porta interna: 8080
```

O backend depende da disponibilidade saudável do PostgreSQL.

Variáveis utilizadas:

```text
SPRING_PROFILES_ACTIVE
SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME
SPRING_DATASOURCE_PASSWORD
```

## Frontend

O compose atual utiliza o diretório:

```text
./agerp-frontend
```

O frontend é servido pelo container na porta interna 80.

## Rede

Todos os serviços utilizam a rede Docker:

```text
agnet
```

## Variáveis externas

O compose utiliza `.env` para parâmetros como:

```text
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
HOST_POSTGRES_PORT
HOST_API_PORT
HOST_APP_PORT
HOST_FRONTEND_PORT
```

Nunca versionar segredos reais.

## Comandos básicos

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f
docker compose down
```

## Diagnóstico

```bash
docker compose ps
docker compose logs backend-api
docker compose logs python-ia-api
docker compose logs postgres
```

## Observação

O compose atual possui algumas dependências comentadas, especialmente a dependência direta do backend em relação ao serviço Python. Isso deve ser revisado conforme a integração do modelo de IA evoluir.
