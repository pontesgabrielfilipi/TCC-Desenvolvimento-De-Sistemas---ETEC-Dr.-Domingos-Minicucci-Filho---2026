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
- `nivel_autoridade` (`INTEGER`, padrão 20)
- `protegido` (`BOOLEAN`, marca ADMIN e OPERADOR)
- `versao` (`BIGINT`, controle otimista de edição)

### PERFIL_PAGINA (V7)
- `id_perfil` (FK de `agerp.perfil`, exclusão em cascata)
- `pagina` (`DASHBOARD`, `CLIENTES`, `PRODUTOS`, `PEDIDOS`, `ADMIN`)
- Chave primária composta (`id_perfil`, `pagina`)

A migração Flyway `V7__cargos_permissoes_paginas.sql` mantém intactos os IDs
de perfil e as referências existentes em `usuario.id_perfil`. Ajusta os níveis
dos perfis históricos (ADMIN 100, GERENTE 60, FINANCEIRO 30, OPERADOR 10,
outros 20), cria perfis padrão ausentes sem duplicá-los e habilita as quatro
páginas operacionais para os cargos existentes. Reserva `ADMIN` apenas para
administradores. Alterações futuras das páginas são persistidas na nova tabela,
sem necessidade de recriar usuários.

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

**Configuração de mínimo de estoque (Flyway V8):** `agerp.configuracao_sistema.usar_estoque_minimo_geral BOOLEAN NOT NULL DEFAULT TRUE` preserva o comportamento anterior do limite geral (`limite_estoque_baixo`, padrão 15). Quando `TRUE`, a regra compara todos os saldos ao limite geral; quando `FALSE`, usa `agerp.estoque.quantidade_minima` por produto. Os limites individuais são preservados durante a alternância. Para registros antigos com mínimo individual `NULL`, somente o cálculo utiliza fallback 10, sem atualizar o valor persistido. Comparação estrita `<`, em unidades inteiras. O mínimo individual 0 é permitido (não dispara alerta); quantidade atual `NULL` não participa das contagens.

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
