-- Caso o banco agdb não exista, ele cria
SELECT 'CREATE DATABASE agdb' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'agdb')\gexec

-- Conecta no banco agdb para rodar o restante do script
\c agdb

-- Criar e selecionar schema
CREATE SCHEMA IF NOT EXISTS agerp;
SET search_path TO agerp, public;

truncate table usuario RESTART IDENTITY CASCADE;

TRUNCATE TABLE
    log_sistema,
    pagamento,
    previsao_entrega,
    entrega,
    item_pedido,
    pedido,
    movimentacao_estoque,
    estoque,
    produto,
    endereco,
    cliente,
    usuario,
    perfil
    RESTART IDENTITY CASCADE;