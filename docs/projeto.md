# Projeto AGERP

## Identificação

- **Nome:** AGERP - Sistema ERP com Módulo de Previsão de Entrega utilizando Machine Learning
- **Instituição:** Centro Estadual de Educação Tecnológica Paula Souza - ETEC Dr. Domingos Minicucci Filho
- **Local:** Botucatu - SP
- **Ano:** 2026
- **Autores:** André Correia Gomes da Silva e Gabriel Filipe Pontes
- **Orientador:** Prof. Marcos
- **Tipo:** Trabalho de Conclusão de Curso (TCC)

## Objetivo geral

Desenvolver um sistema ERP completo, escalável e de baixo custo para Pequenas e Médias Empresas (PMEs), integrado a um microsserviço inteligente de previsão do tempo de entrega baseado em Machine Learning.

## Problema

PMEs podem enfrentar dificuldades para adotar sistemas ERP tradicionais devido ao custo, complexidade e necessidade de integração entre processos administrativos, estoque, pedidos e logística.

O AGERP busca centralizar esses processos e acrescentar uma camada preditiva para apoiar a estimativa de prazos de entrega.

## Principais módulos

1. Autenticação e segurança
2. Gestão de usuários e perfis
3. Gestão de clientes e endereços
4. Produtos e estoque
5. Pedidos
6. Pagamentos
7. Entregas
8. Previsão de entrega com Machine Learning
9. Dashboard executivo
10. Logs do sistema

## Stack atual verificada no repositório

### Backend
- Java 25
- Spring Boot 4.1.0
- Spring Security
- JWT 0.12.6
- Spring Data JPA / Hibernate
- PostgreSQL
- Maven

### Frontend
O repositório atual utiliza `agerp-frontend/`.
- React 19.2.x
- TypeScript
- Vite 8
- Axios
- React Router
- Tailwind CSS
- Recharts

### Infraestrutura
- Docker
- Docker Compose
- PostgreSQL 16
- Microsserviço Python/FastAPI preparado em `services/python-ia`

## Observação sobre versões

O material acadêmico inicial menciona Java 21/25, Spring Boot 3 e React 18. O estado atual do repositório, porém, registra Java 25, Spring Boot 4.1.0 e React 19.2.x. Para documentação técnica, deve-se considerar o estado atual do código e atualizar o texto acadêmico quando necessário.

## Estrutura geral atual

```text
AGERP/
├── src/                    # aplicação Spring Boot no repositório atual
├── agerp-frontend/         # frontend React/Vite
├── services/
│   └── python-ia/          # microsserviço de IA
├── docker/
│   └── postgres/
├── docker-compose.yml
├── Dockerfile
├── pom.xml
├── .env.example
└── docs/
```

## Fonte do projeto

Repositório GitHub:
https://github.com/pontesgabrielfilipi/TCC-Desenvolvimento-De-Sistemas---ETEC-Dr.-Domingos-Minicucci-Filho---2026
