<!--
Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.
-->

# AGERP — Sistema de Gestão Empresarial

O **AGERP** é um sistema ERP desenvolvido como Trabalho de Conclusão de Curso
na ETEC Dr. Domingos Minicucci Filho, em Botucatu (SP). A aplicação centraliza
rotinas de pequenas e médias empresas em uma única plataforma, reunindo
autenticação, usuários, clientes, produtos, estoque, pedidos, indicadores,
relatórios e auditoria. O sistema também integra um microsserviço de Machine
Learning para previsão de tempo de entrega.

Esta versão representa a entrega final do projeto acadêmico, com backend,
frontend, banco de dados, microsserviço de previsão, infraestrutura
conteinerizada e documentação técnica organizados no mesmo repositório.

## Principais funcionalidades

- Autenticação com JWT em cookie HttpOnly, proteção CSRF e controle de acesso
  por perfil e página.
- Cadastro e gerenciamento de usuários, perfis de acesso, clientes e
  endereços.
- Cadastro de produtos, controle de estoque e registro de movimentações.
- Criação, acompanhamento e atualização de pedidos por status.
- Dashboard operacional com indicadores de vendas, pedidos, clientes, estoque
  e evolução de resultados.
- Estatísticas administrativas com gráficos de pedidos por status, perfis de
  usuários, evolução de pedidos e desempenho por usuário.
- Relatórios administrativos com exportação para XLSX.
- Auditoria de operações relevantes do sistema, com consulta e filtros de logs.
- Previsão de prazo de entrega por Machine Learning, com integração ao
  serviço Python e tratamento de indisponibilidade do serviço de IA.
- Interface responsiva para uso em computadores e dispositivos móveis.

## Arquitetura

O AGERP é composto por quatro serviços principais:

| Serviço | Responsabilidade | Tecnologia |
| --- | --- | --- |
| `backend-api` | API, regras de negócio, autenticação e autorização | Java 25, Spring Boot 4.1, Spring Security, JPA/Hibernate |
| `frontend` | Interface web e consumo da API | React 19, TypeScript 6, Vite 8, Tailwind CSS e Recharts |
| `postgres` | Persistência dos dados e migrations | PostgreSQL 16 e Flyway |
| `python-ia-api` | Previsão de tempo de entrega | Python, FastAPI e scikit-learn |

O navegador se comunica com o frontend, servido pelo Nginx. As chamadas para
`/api` são encaminhadas ao backend, que acessa o PostgreSQL e o microsserviço
Python pela rede interna do Docker. O navegador não acessa o banco de dados
diretamente.

## Tecnologias

- **Backend:** Java 25, Spring Boot 4.1.0, Spring Security, JWT, Spring Data
  JPA, Hibernate, Flyway, Maven e Actuator.
- **Frontend:** React 19, TypeScript 6, Vite 8, Axios, React Router,
  Recharts, Bootstrap e Tailwind CSS.
- **Dados e IA:** PostgreSQL 16, Python 3.11, FastAPI, Pandas, NumPy e
  scikit-learn.
- **Infraestrutura:** Docker, Docker Compose e Nginx.
- **Testes:** JUnit, Mockito, Spring MockMvc, testes de integração e
  Playwright.

As versões oficiais do backend e do frontend estão definidas em
[`pom.xml`](pom.xml) e [`agerp-frontend/package.json`](agerp-frontend/package.json).

## Estrutura do repositório

```text
.
├── src/
│   ├── main/java/com/agerp/agerp/  # API e regras de negócio Spring Boot
│   ├── main/resources/             # Configurações e migrations Flyway
│   └── test/                       # Testes automatizados do backend
├── agerp-frontend/                 # Aplicação React/Vite e testes E2E
├── services/python-ia/             # API Python e modelo de previsão
├── docker/postgres/init/           # Inicialização do banco em volume novo
├── scripts/                        # Scripts de validação e operação
├── docs/                           # Documentação técnica e acadêmica
├── docker-compose.yml              # Orquestração dos serviços
├── Dockerfile                      # Imagem do backend
├── .env.example                    # Modelo de configuração local
└── pom.xml                         # Configuração Maven do backend
```

## Requisitos

Para executar todos os serviços, instale:

- Docker Engine ou Docker Desktop com Docker Compose;
- Git;
- JDK 25 e Maven, para executar o backend fora do Docker;
- Node.js e npm compatíveis com o Vite 8, para executar o frontend fora do
  Docker;
- Python 3.11, caso o microsserviço de IA seja executado diretamente no host.

## Execução com Docker Compose

1. Clone o repositório e entre na pasta do projeto:

   ```powershell
   git clone https://github.com/pontesgabrielfilipi/TCC-Desenvolvimento-De-Sistemas---ETEC-Dr.-Domingos-Minicucci-Filho---2026.git
   cd TCC-Desenvolvimento-De-Sistemas---ETEC-Dr.-Domingos-Minicucci-Filho---2026
   ```

2. Crie o arquivo privado de ambiente:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Substitua todos os valores `CHANGE_ME` e ajuste as origens permitidas,
   portas e segredos conforme o ambiente. O `JWT_SECRET` deve possuir pelo
   menos 32 caracteres e não deve ser versionado.

4. Construa e inicie os serviços:

   ```powershell
   docker compose --env-file .env up --build -d
   ```

5. Verifique o estado dos containers:

   ```powershell
   docker compose --env-file .env ps
   ```

Com a configuração padrão, a aplicação fica disponível em
`http://localhost:5173`. O backend fica na porta `8080`, a API Python na
porta `8002` e o PostgreSQL na porta `15432`. As portas publicadas podem ser
alteradas no `.env`.

Para encerrar a execução sem remover os dados persistidos:

```powershell
docker compose --env-file .env down
```

Não utilize `docker compose down -v` em um ambiente que contenha dados que
precisem ser preservados.

As opções de ambiente, o fluxo de inicialização e as recomendações de
operação estão detalhados em [Configuração por ambiente](docs/configuracao-ambientes.md)
e [Docker](docs/docker.md).

## Execução para desenvolvimento

### Backend

Configure o PostgreSQL e as variáveis de ambiente conforme
[Configuração por ambiente](docs/configuracao-ambientes.md). Em seguida,
execute na raiz:

```powershell
mvnw.cmd spring-boot:run
```

### Frontend

Em outro terminal:

```powershell
Set-Location agerp-frontend
npm ci
npm run dev
```

O Vite utiliza a porta `5173` por padrão e encaminha `/api` para o backend
local, normalmente em `http://127.0.0.1:8080`. Esse destino pode ser ajustado
por `AGERP_DEV_PROXY_TARGET`.

### Microsserviço de IA

O serviço está em [`services/python-ia`](services/python-ia). Para executá-lo
fora do Docker, crie um ambiente virtual, instale
[`requirements.txt`](services/python-ia/requirements.txt) e siga as
instruções específicas do módulo. No ambiente conteinerizado, o backend usa
`http://python-ia-api:8000`.

## Testes e validação

Backend:

```powershell
mvnw.cmd test
```

Frontend:

```powershell
Set-Location agerp-frontend
npm ci
npm run lint
npm run build
npm run test:e2e
```

Os testes E2E dependem de um ambiente frontend/backend disponível e
configurado. Os relatórios e evidências de validação do projeto estão
documentados em [Relatórios](docs/relatorios.md) e
[Validação técnica](docs/validacao-v01-p1.md).

## Documentação

- [Índice da documentação técnica e acadêmica](docs/README.md)
- [Arquitetura](docs/arquitetura.md)
- [Backend](docs/backend.md)
- [Frontend](docs/frontend.md)
- [Banco de dados](docs/banco-de-dados.md)
- [Autenticação e segurança](docs/autenticacao.md)
- [Pedidos e previsão de entrega](docs/pedidos.md)
- [Relatórios e exportação XLSX](docs/relatorios.md)
- [Auditoria de operações](docs/auditoria-negocio.md)
- [Configuração por ambiente](docs/configuracao-ambientes.md)
- [Docker](docs/docker.md)
- [Documentação do TCC](docs/tcc/)

## Autoria

Projeto desenvolvido por **André Correia Gomes da Silva** e **Gabriel Filipi
Pontes**, sob orientação do **Prof. Marcos**, no curso da ETEC Dr. Domingos
Minicucci Filho, em 2026.

## Licença

O código próprio do projeto está disponível sob licença proprietária. A
reutilização, distribuição ou modificação depende de autorização prévia e
escrita dos titulares, conforme o arquivo [LICENSE](LICENSE).

Bibliotecas e dependências de terceiros mantêm suas próprias licenças. O
módulo [`services/python-ia`](services/python-ia/) possui um
[`LICENSE` MIT próprio](services/python-ia/LICENSE), que deve ser respeitado
separadamente.
