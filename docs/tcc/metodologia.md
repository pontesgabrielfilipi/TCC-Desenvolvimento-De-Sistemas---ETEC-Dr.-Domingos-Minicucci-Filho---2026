<!--
Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.
-->

# Metodologia

## Tipo de pesquisa

O projeto caracteriza-se como **pesquisa aplicada e desenvolvimento tecnológico**, pois busca produzir uma solução computacional para um problema prático de gestão empresarial e logística.

## Metodologia de desenvolvimento

Foi adotado desenvolvimento incremental, com entregas parciais, testes e validação contínua.

A construção foi dividida em componentes independentes:
- backend;
- frontend;
- banco de dados;
- infraestrutura;
- microsserviço de Machine Learning.

## Tecnologias

### Backend
- Java 25 no estado atual do repositório;
- Spring Boot;
- Spring Security;
- JWT;
- Spring Data JPA;
- Hibernate;
- Maven.

### Frontend
- React;
- TypeScript;
- Vite;
- Tailwind CSS;
- Axios.

### Banco
- PostgreSQL.

### Machine Learning
- Python;
- scikit-learn;
- Random Forest Regressor;
- FastAPI.

### Infraestrutura
- Docker;
- Docker Compose;
- Git/GitHub.

## Base de dados

O modelo de previsão utiliza dados reais de e-commerce brasileiro provenientes da base Olist.

## Features do modelo

Foram consideradas variáveis relacionadas ao pedido, logística, localização e produto:

- preço do pedido;
- valor do frete;
- cidade/estado/CEP do cliente;
- cidade/estado/CEP do vendedor;
- categoria do produto;
- peso;
- comprimento;
- altura;
- largura;
- dia da semana;
- mês;
- hora do pedido.

## Processo

```text
Levantamento do problema
        ↓
Definição dos requisitos
        ↓
Modelagem
        ↓
Desenvolvimento incremental
        ↓
Integração
        ↓
Testes
        ↓
Validação
        ↓
Documentação
```

## Observação sobre versões

O material inicial do projeto menciona Java 21/25, Spring Boot 3 e React 18. Como o repositório evoluiu, o texto final deve registrar as versões efetivamente utilizadas na entrega final.
