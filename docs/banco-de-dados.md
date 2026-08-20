# Banco de Dados

## Tecnologia

- PostgreSQL 16
- JPA/Hibernate
- Flyway quando utilizado no fluxo de migrações

## Entidades

### PERFIL
- `id_perfil`
- `nome`
- `descricao`

### USUARIO
- `id_usuario`
- `nome`
- `email`
- `senha_hash`
- `ativo`
- `data_criacao`
- `id_perfil`

### CLIENTE
- `id_cliente`
- `tipo`
- `nome_razao`
- `cpf_cnpj`
- `email`
- `telefone`
- `data_cadastro`

### ENDERECO
- `id_endereco`
- `id_cliente`
- `logradouro`
- `numero`
- `bairro`
- `cidade`
- `estado`
- `cep`
- `latitude`
- `longitude`

### PRODUTO
- `id_produto`
- `nome`
- `descricao`
- `preco`
- `peso`
- `volume`
- `ativo`

### ESTOQUE
- `id_estoque`
- `id_produto`
- `quantidade_atual`
- `quantidade_minima`
- `localizacao`

### MOVIMENTACAO_ESTOQUE
- `id_movimentacao`
- `id_produto`
- `tipo`
- `quantidade`
- `data_movimentacao`
- `id_usuario`

### PEDIDO
- `id_pedido`
- `id_cliente`
- `data_pedido`
- `status`
- `valor_total`
- `id_usuario`

### ITEM_PEDIDO
- `id_item`
- `id_pedido`
- `id_produto`
- `quantidade`
- `preco_unitario`

### PAGAMENTO
- `id_pagamento`
- `id_pedido`
- `tipo_pagamento`
- `valor`
- `status`
- `data_pagamento`

### ENTREGA
- `id_entrega`
- `id_pedido`
- `data_saida`
- `data_entrega`
- `status`
- `tempo_estimado_ia`
- `tempo_real`
- `distancia_km`

### PREVISAO_ENTREGA
- `id_previsao`
- `id_entrega`
- `data_calculo`
- `distancia`
- `transito_estimado`
- `clima`
- `tempo_previsto_min`
- `modelo_versao`
- features utilizadas pelo modelo
- `prazo_entrega_dias`

### LOG_SISTEMA
- `id_log`
- `id_usuario`
- `acao`
- `entidade`
- `data_hora`
- `ip`

## Relacionamentos principais

```text
PERFIL 1 ─── N USUARIO

CLIENTE 1 ─── N ENDERECO
CLIENTE 1 ─── N PEDIDO

USUARIO 1 ─── N PEDIDO
USUARIO 1 ─── N MOVIMENTACAO_ESTOQUE
USUARIO 1 ─── N LOG_SISTEMA

PRODUTO 1 ─── 1 ESTOQUE
PRODUTO 1 ─── N ITEM_PEDIDO
PRODUTO 1 ─── N MOVIMENTACAO_ESTOQUE

PEDIDO 1 ─── N ITEM_PEDIDO
PEDIDO 1 ─── N PAGAMENTO
PEDIDO 1 ─── 1 ENTREGA

ENTREGA 1 ─── 1 PREVISAO_ENTREGA
```

## Regras importantes

- Usuários pertencem a um perfil.
- Clientes podem possuir múltiplos endereços.
- Pedidos pertencem a clientes e são registrados por usuários.
- Produtos podem aparecer em diversos itens de pedido.
- Estoque é associado ao produto.
- Movimentações registram alterações de estoque.
- Uma entrega está associada a um pedido.
- Uma previsão pode ser vinculada à entrega.
- Logs registram ações relevantes do sistema.

## Dados do modelo de IA

As features de treinamento incluem:
- preço;
- valor do frete;
- cidade, estado e CEP do cliente;
- cidade, estado e CEP do vendedor;
- categoria do produto;
- peso;
- comprimento;
- altura;
- largura;
- dia da semana;
- mês;
- hora do pedido.
