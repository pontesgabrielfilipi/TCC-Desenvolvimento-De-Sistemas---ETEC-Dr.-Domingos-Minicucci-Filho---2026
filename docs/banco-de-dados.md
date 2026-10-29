<!--
Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.
-->

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
## Auditoria correlacionada (V9)

A V9 adiciona campos opcionais a `agerp.log_sistema` sem preencher artificialmente registros históricos: `event_id` (UUID único para novos eventos), `request_id` (UUID gerado pelo servidor), `correlation_id` (identificador externo validado), `session_ref` e `device_ref` (reservados para A03), `event_schema_version`, `peer_ip`, `user_agent`, `http_method`, `http_route`, `http_status`, `duration_ms` e `changes_json` (`JSONB`). O campo `ip` continua representando a origem validada, distinta do peer TCP. `http_status` e `duration_ms` ficam nulos em eventos de domínio emitidos antes do fim da requisição; não devem ser estimados.

Eventos de sucesso chamados dentro de transações de domínio usam a mesma transação e `saveAndFlush`: erro de escrita aborta a operação; rollback remove o evento junto com a alteração. Eventos independentes de falha/negação podem usar transação própria, sem caracterizar sucesso. `event_id` identifica a linha, não é chave idempotente de operação: retries independentes podem emitir novos IDs. `request_id` permite correlacionar eventos de uma requisição; não implica unicidade por requisição. Dispachos `ASYNC` e `ERROR` não devem registrar eventos de domínio adicionais. O contexto assíncrono deve ser transferido explicitamente com `AuditRequestContext.wrap` e sempre limpo ao final.

O contrato de diferenças `changes_json` aceita somente campos expressamente permitidos, valores simples, até 16 chaves e 120 caracteres por valor de texto. Não serializar entidades ou corpos HTTP. Campos fora da allowlist e referências a credenciais são descartados ou mascarados. Dados históricos (`detalhes`, snapshots, `data_hora`) permanecem legíveis.

**Política temporal:** `data_hora` nasceu como `TIMESTAMP WITHOUT TIME ZONE` em V1, apesar do mapeamento Java como `Instant`. A origem e o timezone dos dados existentes não foram comprovados; V9 deliberadamente **não** converte esse tipo. Antes de qualquer futura conversão, inventariar configuração de timezone do banco/JVM e amostras confiáveis da aplicação, validar horário de origem com responsáveis e documentar plano reversível. Nunca assumir UTC para linhas antigas.

**Privilégios:** V9 revoga `UPDATE`, `DELETE`, `TRUNCATE` da tabela de auditoria do papel configurado por `spring.flyway.placeholders.auditAppRole` e de `PUBLIC`; a migration deve rodar sob proprietário/superusuário, separado do login operacional. Confirmar no ambiente isolado com `has_table_privilege` e verificar herança de papéis. Proprietário e superusuário continuam com poder de alteração, portanto não há garantia de imutabilidade absoluta. O script inicial do Postgres concede privilégios gerais; a revogação específica ocorre depois na V9. Aplicar a migração novamente após qualquer processo administrativo que conceda privilégios amplos.

**Retenção:** definir prazo por ambiente mediante decisão documentada do responsável e exigências aplicáveis, sem estabelecer prazo legal presumido. Não existe descarte automático. Para descartar, operador autorizado deve aprovar escopo e intervalo, gerar exportação/backup verificável, executar operação em janela de manutenção com papel distinto do operacional e guardar comprovante de descarte; validar restauração antes. Não executar limpeza por conta do sistema.
