<!--
Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.
-->

# Arquitetura

## Visão geral

O AGERP utiliza uma arquitetura modular baseada em API REST, com separação entre interface, regras de negócio, persistência e serviço de Machine Learning.

```text
┌─────────────────────┐
│   React / Vite      │
│   Frontend          │
└──────────┬──────────┘
           │ HTTP/REST
           ▼
┌─────────────────────┐
│ Spring Boot         │
│ API / Segurança     │
│ Regras de negócio   │
└───────┬───────┬─────┘
        │       │
        │       └──────────────┐
        ▼                      ▼
┌───────────────┐      ┌──────────────────┐
│ PostgreSQL    │      │ Python/FastAPI   │
│ Persistência  │      │ Machine Learning │
└───────────────┘      └──────────────────┘
```

## Responsabilidades

### Frontend

Responsável por:
- interface do usuário;
- navegação;
- formulários;
- dashboards;
- consumo da API;
- gerenciamento do estado de autenticação;
- apresentação dos dados.

### Backend

Responsável por:
- autenticação e autorização;
- regras de negócio;
- validação;
- APIs REST;
- persistência;
- gerenciamento das entidades;
- integração com serviços externos;
- comunicação com o microsserviço de IA.

### PostgreSQL

Responsável pela persistência dos dados operacionais e históricos.

### Python/FastAPI

Responsável pelas inferências do modelo de previsão de entrega.

## Organização do backend

A organização lógica segue camadas:

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Entity / PostgreSQL
```

Componentes de segurança ficam separados em configuração, serviço de usuário e filtro JWT.

## Integração com IA

O backend fornece ao microsserviço os dados necessários para a previsão. O serviço Python executa a inferência do modelo e retorna o resultado para utilização no fluxo de entrega.

## Princípios

- Separação de responsabilidades
- Baixo acoplamento entre módulos
- APIs REST
- Persistência relacional
- Segurança por autenticação e autorização
- Containers para padronização do ambiente
