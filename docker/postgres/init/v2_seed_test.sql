-- Caso o banco agdb não exista, ele cria
SELECT 'CREATE DATABASE agdb' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'agdb')\gexec

-- Conecta no banco agdb para rodar o restante do script
\c agdb

-- Criar e selecionar schema
CREATE SCHEMA IF NOT EXISTS agerp;
SET search_path TO agerp, public;



-- Limpar dados anteriores (opcional, útil para evitar erro de duplicidade em re-run)
-- TRUNCATE perfil, usuario, cliente, produto RESTART IDENTITY CASCADE;

INSERT INTO perfil (nome, descricao)
VALUES ('ADMIN', 'Administrador do sistema'),
       ('OPERADOR', 'Operador padrão');

INSERT INTO usuario (nome, email, senha_hash, id_perfil)
VALUES ('Admin Master', 'admin@agerp.com', '$2a$12$GGuqRK1hd7JJAnzsZWzblOqtORqpm3MSR.V/BCKALxsLGGqKIDiAK', 1),
       ('Operador Silva', 'operador@agerp.com', '$2a$12$GGuqRK1hd7JJAnzsZWzblOqtORqpm3MSR.V/BCKALxsLGGqKIDiAK', 2);

INSERT INTO cliente (tipo, nome_razao, cpf_cnpj, email, telefone)
VALUES ('PF', 'João da Silva', '12345678900', 'joao@email.com', '11999999999');

INSERT INTO endereco
(id_cliente, logradouro, numero, bairro, cidade, estado, cep, latitude, longitude)
VALUES (1, 'Rua Central', '100', 'Centro', 'São Paulo', 'SP', '01000000', -23.5505, -46.6333);

INSERT INTO produto (nome, descricao, preco, peso, volume)
VALUES ('Notebook', 'Dell i7', 3500.00, 2.5, 0.003),
       ('Mouse', 'Gamer RGB', 150.00, 0.2, 0.001);

INSERT INTO estoque (id_produto, quantidade_atual, quantidade_minima, localizacao)
VALUES (1, 10, 2, 'A1'),
       (2, 50, 5, 'B1');

INSERT INTO movimentacao_estoque (id_produto, tipo, quantidade, id_usuario)
VALUES (1, 'ENTRADA', 10, 1),
       (2, 'ENTRADA', 50, 1);

INSERT INTO pedido (id_cliente, status, valor_total, id_usuario)
VALUES (1, 'CRIADO', 3650.00, 2);

INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario)
VALUES (1, 1, 1, 3500.00),
       (1, 2, 1, 150.00);

INSERT INTO entrega (id_pedido, status, tempo_estimado_ia, distancia_km)
VALUES (1, 'EM_ROTA', 45, 12.5);

-- CORREÇÃO AQUI: Valores de City e State agora são Strings conforme o Schema
-- Adicionado também os CEPs que estavam faltando na inserção original
INSERT INTO previsao_entrega (
    id_entrega, data_calculo, distancia, transito_estimado, clima,
    tempo_previsto_min, modelo_versao, price, freight_value,
    customer_city, customer_state, customer_cep,
    seller_city, seller_state, seller_cep,
    product_category_name, product_weight_g,
    product_length_cm, product_height_cm, product_width_cm,
    order_weekday, order_month, order_hour, prazo_entrega_dias
)
VALUES (
           1, NOW(), 12.5, 'MEDIO', 'SOL',
           45, 'v1', 3650.00, 25.00,
           'São Paulo', 'SP', '01000000',
           'Rio de Janeiro', 'RJ', '20000000',
           'Eletronico', 2500,
           30, 5, 20,
           3, 2, 14, 2
       );

INSERT INTO pagamento (id_pedido, tipo_pagamento, valor, status, data_pagamento)
VALUES (1, 'CARTAO', 3650.00, 'PAGO', NOW());

INSERT INTO log_sistema (id_usuario, acao, entidade, ip)
VALUES (1, 'CRIAR_PEDIDO', 'pedido', '127.0.0.1');
