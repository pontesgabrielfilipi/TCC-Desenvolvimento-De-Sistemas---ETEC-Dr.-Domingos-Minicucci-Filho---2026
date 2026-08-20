# Desenvolvimento

## Arquitetura geral

O AGERP foi estruturado em camadas desacopladas e APIs REST.

O backend Java concentra regras de negócio, autenticação e persistência. O frontend React consome as APIs. O microsserviço Python/FastAPI executa as inferências do modelo de Machine Learning.

## Modelo de dados

As principais entidades são:

```text
PERFIL
USUARIO
CLIENTE
ENDERECO
PRODUTO
ESTOQUE
MOVIMENTACAO_ESTOQUE
PEDIDO
ITEM_PEDIDO
PAGAMENTO
ENTREGA
PREVISAO_ENTREGA
LOG_SISTEMA
```

## Módulos

### 1. Autenticação e Segurança

Utiliza JWT em HttpOnly Cookie e controle de acesso por perfil.

Perfis:
- ADMIN
- GERENTE
- OPERADOR
- FINANCEIRO

### 2. Usuários e Clientes

Permite estruturar o cadastro de usuários e clientes, incluindo clientes PF/PJ e múltiplos endereços.

### 3. Produtos e Estoque

Abrange:
- cadastro de produtos;
- quantidade atual;
- estoque mínimo;
- movimentações;
- localização;
- alertas.

### 4. Pedidos e Entregas

Abrange:
- emissão de pedidos;
- itens;
- pagamentos;
- acompanhamento;
- entrega;
- estimativa de prazo.

### 5. Dashboard

Indicadores planejados/implementados conforme o estágio do projeto:
- vendas do mês;
- clientes inativos;
- estoque baixo;
- evolução das vendas;
- top 5 produtos mais vendidos;
- status dos pedidos.

## Machine Learning

O modelo utiliza Random Forest Regressor.

As features incluem informações de preço, frete, origem, destino, produto e momento do pedido.

Fluxo:

```text
Pedido
  ↓
Dados relevantes
  ↓
Backend
  ↓
FastAPI
  ↓
Random Forest Regressor
  ↓
Previsão
  ↓
Backend
  ↓
Entrega / Dashboard
```

## Containerização

Os serviços são organizados por Docker Compose para permitir execução padronizada do banco, backend, frontend e microsserviço de IA.

## Integração entre tecnologias

A solução combina:
- Java/Spring Boot para a aplicação principal;
- React para interface;
- PostgreSQL para persistência;
- Python/FastAPI para Machine Learning;
- Docker para infraestrutura.

Essa separação permite que o modelo de IA seja evoluído sem precisar incorporar o runtime Python diretamente ao backend Java.
