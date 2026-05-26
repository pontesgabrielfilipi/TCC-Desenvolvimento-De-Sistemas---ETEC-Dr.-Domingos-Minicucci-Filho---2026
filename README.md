### 🏢 AGERP - Enterprise Resource Planning

![Java](https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-6DB33F?style=for-the-badge&logo=spring&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=json-web-tokens&logoColor=white)

**AGERP** é um sistema ERP completo desenvolvido como Trabalho de Conclusão de Curso (TCC). Combina um backend robusto em **Java + Spring Boot** com um frontend moderno em **React + Vite**, utilizando autenticação via **JWT** com **HttpOnly Cookie**.

## 🏗️ Tecnologias Utilizadas

### Backend

```
- Java 21/25 + Spring Boot 3
- Spring Security + JWT
- Spring Data JPA + Hibernate
- PostgreSQL
- Maven
- Docker & Docker Compose
```

### Frontend

```
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS
- React Router DOM
- Axios
```

### Infraestrutura

```
- Docker
- Docker Compose
```

## 📁 Estrutura Completa do Projeto

```
AGERP/
├── backend/                          # API Spring Boot
│   ├── src/main/java/com/agerp/agerp/
│   │   ├── config/
│   │   ├── controller/
│   │   ├── dto/
│   │   ├── entity/
│   │   ├── repository/
│   │   ├── security/
│   │   │   └── jwt/
│   │   ├── service/
│   │   └── AgerpApplication.java
│   ├── src/main/resources/
│   ├── pom.xml
│   └── application.properties
│
├── frontend/                         # React + Vite
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── docker-compose.yml
├── README.md
└── .env.example
```

## 🗄️ Diagrama de Entidade-Relacionamento (DER)

```mermaid
erDiagram
    PERFIL ||--o{ USUARIO : "possui"
    CLIENTE ||--o{ ENDERECO : "possui"
    CLIENTE ||--o{ PEDIDO : "realiza"
    USUARIO ||--o{ PEDIDO : "registra"
    PEDIDO ||--|{ ITEM_PEDIDO : "contem"
    PRODUTO ||--o{ ITEM_PEDIDO : "compoe"
    PRODUTO ||--|| ESTOQUE : "possui"
    PRODUTO ||--o{ MOVIMENTACAO_ESTOQUE : "movimenta"
    USUARIO ||--o{ MOVIMENTACAO_ESTOQUE : "realiza"
    PEDIDO ||--|| ENTREGA : "gera"
    ENTREGA ||--|| PREVISAO_ENTREGA : "possui"
    PEDIDO ||--o{ PAGAMENTO : "recebe"
    USUARIO ||--o{ LOG_SISTEMA : "gera"

    PERFIL {
        int id_perfil PK
        varchar nome
        text descricao
    }

    USUARIO {
        int id_usuario PK
        varchar nome
        varchar email
        text senha_hash
        boolean ativo
        timestamp data_criacao
        int id_perfil FK
    }

    CLIENTE {
        int id_cliente PK
        varchar tipo
        varchar nome_razao
        varchar cpf_cnpj
        varchar email
        varchar telefone
        timestamp data_cadastro
    }

    ENDERECO {
        int id_endereco PK
        int id_cliente FK
        varchar logradouro
        varchar numero
        varchar bairro
        varchar cidade
        varchar estado
        varchar cep
        numeric latitude
        numeric longitude
    }

    PRODUTO {
        int id_produto PK
        varchar nome
        text descricao
        numeric preco
        numeric peso
        numeric volume
        boolean ativo
    }

    ESTOQUE {
        int id_estoque PK
        int id_produto FK "UNIQUE"
        int quantidade_atual
        int quantidade_minima
        varchar localizacao
    }

    MOVIMENTACAO_ESTOQUE {
        int id_movimentacao PK
        int id_produto FK
        varchar tipo
        int quantidade
        timestamp data_movimentacao
        int id_usuario FK
    }

    PEDIDO {
        int id_pedido PK
        int id_cliente FK
        timestamp data_pedido
        varchar status
        numeric valor_total
        int id_usuario FK
    }

    ITEM_PEDIDO {
        int id_item PK
        int id_pedido FK
        int id_produto FK
        int quantidade
        numeric preco_unitario
    }

    ENTREGA {
        int id_entrega PK
        int id_pedido FK "UNIQUE"
        timestamp data_saida
        timestamp data_entrega
        varchar status
        int tempo_estimado_ia
        int tempo_real
        numeric distancia_km
    }

    PREVISAO_ENTREGA {
        int id_previsao PK
        int id_entrega FK "UNIQUE"
        timestamp data_calculo
        numeric distancia
        varchar transito_estimado
        varchar clima
        int tempo_previsto_min
        varchar modelo_versao
        numeric price
        numeric freight_value
        varchar customer_city
        varchar customer_state
        varchar customer_cep
        varchar seller_city
        varchar seller_state
        varchar seller_cep
        varchar product_category_name
        numeric product_weight_g
        numeric product_length_cm
        numeric product_height_cm
        numeric product_width_cm
        int order_weekday
        int order_month
        int order_hour
        int prazo_entrega_dias
    }

    PAGAMENTO {
        int id_pagamento PK
        int id_pedido FK
        varchar tipo_pagamento
        numeric valor
        varchar status
        timestamp data_pagamento
    }

    LOG_SISTEMA {
        int id_log PK
        int id_usuario FK
        varchar acao
        varchar entidade
        timestamp data_hora
        varchar ip
    }
```

## 🚀 Como Rodar o Projeto

### Backend

```
cd backend
mvn clean install
mvn spring-boot:run
```

A API Java estará disponível em: `http://localhost:8080`

### Frontend

```
cd frontend
npm install
npm run dev
```

O frontend estará disponível em: `http://localhost:5173`

---

## Funcionalidades Implementadas

- Autenticação com JWT + HttpOnly Cookie
- Gestão de Usuários e Perfis (ADMIN, GERENTE, OPERADOR, FINANCEIRO)
- Dashboard dinâmico
- CRUD de Clientes (em desenvolvimento no React)
- Estrutura completa preparada para expansão

---

**Próximos Passos:**

- Finalizar CRUD de Clientes no React
- Implementar gráficos no Dashboard
- Criar microsserviço de IA para previsão de entregas
- Preparar ambiente de produção com Docker Compose

---

Feito por Gabriel Filipi Pontes

Última atualização: Abril 2026
