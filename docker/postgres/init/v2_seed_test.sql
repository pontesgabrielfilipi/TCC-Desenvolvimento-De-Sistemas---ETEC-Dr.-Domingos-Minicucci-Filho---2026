-- Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
-- Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

-- Dados sintéticos relacionados para o ambiente de teste.
-- O entrypoint oficial já conecta no banco definido por POSTGRES_DB.
CREATE SCHEMA IF NOT EXISTS agerp;
SET search_path TO agerp,
    public;
-- A carga é destrutiva e apaga os dados existentes nas tabelas relacionadas.
TRUNCATE TABLE log_sistema,
pagamento,
previsao_entrega,
entrega,
item_pedido,
pedido,
movimentacao_estoque,
estoque,
endereco,
produto,
cliente,
usuario,
perfil RESTART IDENTITY CASCADE;
-- Perfis
INSERT INTO perfil (nome, descricao)
VALUES ('ADMIN', 'Administrador do sistema'),
    ('OPERADOR', 'Operador padrão');
-- Usuários
INSERT INTO usuario (
        nome,
        email,
        senha_hash,
        id_perfil,
        status_acesso
    )
SELECT CASE
        WHEN gs = 1 THEN 'Admin Master'
        ELSE 'Usuário Teste ' || gs
    END,
    CASE
        WHEN gs = 1 THEN 'admin@agerp.com'
        ELSE 'usuario' || gs || '@agerp.com'
    END,
    '$2a$12$GGuqRK1hd7JJAnzsZWzblOqtORqpm3MSR.V/BCKALxsLGGqKIDiAK',
    CASE
        WHEN gs <= 5 THEN 1
        ELSE 2
    END,
    'APROVADO'
FROM generate_series(1, 60) AS gs;
-- Clientes
INSERT INTO cliente (
        tipo,
        nome_razao,
        cpf_cnpj,
        email,
        telefone
    )
SELECT CASE
        WHEN gs % 5 = 0 THEN 'PJ'
        ELSE 'PF'
    END,
    CASE
        WHEN gs % 5 = 0 THEN 'Empresa Teste ' || gs || ' LTDA'
        ELSE 'Cliente Teste ' || gs
    END,
    CASE
        WHEN gs % 5 = 0 THEN LPAD((10000000000000 + gs)::TEXT, 14, '0')
        ELSE LPAD((10000000000 + gs)::TEXT, 11, '0')
    END,
    'cliente' || gs || '@teste.com',
    '1199' || LPAD((1000000 + gs)::TEXT, 7, '0')
FROM generate_series(1, 60) AS gs;
-- Endereços
INSERT INTO endereco (
        id_cliente,
        logradouro,
        numero,
        bairro,
        cidade,
        estado,
        cep,
        latitude,
        longitude
    )
SELECT gs,
    CASE
        WHEN gs % 4 = 0 THEN 'Rua das Flores'
        WHEN gs % 4 = 1 THEN 'Rua Central'
        WHEN gs % 4 = 2 THEN 'Avenida Brasil'
        ELSE 'Rua dos Comerciantes'
    END,
    (100 + gs)::TEXT,
    CASE
        WHEN gs % 3 = 0 THEN 'Centro'
        WHEN gs % 3 = 1 THEN 'Jardim Paulista'
        ELSE 'Vila Nova'
    END,
    CASE
        WHEN gs % 6 = 0 THEN 'Botucatu'
        WHEN gs % 6 = 1 THEN 'São Paulo'
        WHEN gs % 6 = 2 THEN 'Bauru'
        WHEN gs % 6 = 3 THEN 'Campinas'
        WHEN gs % 6 = 4 THEN 'Sorocaba'
        ELSE 'Ribeirão Preto'
    END,
    CASE
        WHEN gs % 6 = 0 THEN 'SP'
        WHEN gs % 6 = 1 THEN 'SP'
        WHEN gs % 6 = 2 THEN 'SP'
        WHEN gs % 6 = 3 THEN 'SP'
        WHEN gs % 6 = 4 THEN 'SP'
        ELSE 'SP'
    END,
    LPAD((1000000 + gs)::TEXT, 8, '0'),
    -23.5505 + (gs * 0.005),
    -46.6333 + (gs * 0.005)
FROM generate_series(1, 60) AS gs;
-- Produtos
INSERT INTO produto (
        nome,
        descricao,
        preco,
        peso,
        volume
    )
SELECT CASE
        WHEN gs % 10 = 1 THEN 'Notebook'
        WHEN gs % 10 = 2 THEN 'Mouse Gamer'
        WHEN gs % 10 = 3 THEN 'Teclado Mecânico'
        WHEN gs % 10 = 4 THEN 'Monitor'
        WHEN gs % 10 = 5 THEN 'Headset'
        WHEN gs % 10 = 6 THEN 'Webcam'
        WHEN gs % 10 = 7 THEN 'SSD'
        WHEN gs % 10 = 8 THEN 'Memória RAM'
        WHEN gs % 10 = 9 THEN 'Placa de Vídeo'
        ELSE 'Smartphone'
    END || ' Modelo ' || gs,
    'Produto de teste AGERP número ' || gs,
    ROUND((50 + (gs * 73.45))::NUMERIC, 2),
    ROUND((0.1 + (gs * 0.15))::NUMERIC, 2),
    ROUND((0.001 + (gs * 0.0005))::NUMERIC, 4)
FROM generate_series(1, 60) AS gs;
-- Estoque
INSERT INTO estoque (
        id_produto,
        quantidade_atual,
        quantidade_minima,
        localizacao
    )
SELECT gs,
    10 + ((gs * 7) % 200),
    5 + (gs % 20),
    CASE
        WHEN gs % 4 = 0 THEN 'A' || ((gs % 10) + 1)
        WHEN gs % 4 = 1 THEN 'B' || ((gs % 10) + 1)
        WHEN gs % 4 = 2 THEN 'C' || ((gs % 10) + 1)
        ELSE 'D' || ((gs % 10) + 1)
    END
FROM generate_series(1, 60) AS gs;
-- Movimentações de estoque
INSERT INTO movimentacao_estoque (
        id_produto,
        tipo,
        quantidade,
        id_usuario
    )
SELECT gs,
    CASE
        WHEN gs % 3 = 0 THEN 'SAIDA'
        ELSE 'ENTRADA'
    END,
    5 + ((gs * 3) % 50),
    CASE
        WHEN gs % 5 = 0 THEN 1
        ELSE 6 + (gs % 55)
    END
FROM generate_series(1, 60) AS gs;
-- Pedidos
INSERT INTO pedido (
        id_cliente,
        status,
        valor_total,
        id_usuario
    )
SELECT gs,
    CASE
        WHEN gs % 6 = 0 THEN 'PENDENTE'
        WHEN gs % 6 = 1 THEN 'CONFIRMADO'
        WHEN gs % 6 = 2 THEN 'EM_PREPARACAO'
        WHEN gs % 6 = 3 THEN 'PRONTO'
        WHEN gs % 6 = 4 THEN 'ENTREGUE'
        ELSE 'CANCELADO'
    END,
    ROUND(
        (
            100 + (gs * 137.55) + ((gs % 7) * 49.90)
        )::NUMERIC,
        2
    ),
    1 + (gs % 60)
FROM generate_series(1, 60) AS gs;
-- Itens dos pedidos
INSERT INTO item_pedido (
        id_pedido,
        id_produto,
        quantidade,
        preco_unitario
    )
SELECT gs,
    ((gs - 1) % 60) + 1,
    1 + (gs % 5),
    ROUND(
        (
            50 + (((gs - 1) % 60 + 1) * 73.45)
        )::NUMERIC,
        2
    )
FROM generate_series(1, 60) AS gs;
-- Entregas
INSERT INTO entrega (
        id_pedido,
        status,
        tempo_estimado_ia,
        distancia_km
    )
SELECT gs,
    CASE
        WHEN gs % 5 = 0 THEN 'ENTREGUE'
        WHEN gs % 5 = 1 THEN 'EM_ROTA'
        WHEN gs % 5 = 2 THEN 'PREPARANDO'
        WHEN gs % 5 = 3 THEN 'ATRASADA'
        ELSE 'PENDENTE'
    END,
    20 + ((gs * 7) % 180),
    ROUND(
        (5 + (gs * 2.35))::NUMERIC,
        2
    )
FROM generate_series(1, 60) AS gs;
-- Previsões de entrega
INSERT INTO previsao_entrega (
        id_entrega,
        data_calculo,
        distancia,
        transito_estimado,
        clima,
        tempo_previsto_min,
        modelo_versao,
        price,
        freight_value,
        customer_city,
        customer_state,
        customer_cep,
        seller_city,
        seller_state,
        seller_cep,
        product_category_name,
        product_weight_g,
        product_length_cm,
        product_height_cm,
        product_width_cm,
        order_weekday,
        order_month,
        order_hour,
        prazo_entrega_dias
    )
SELECT gs,
    NOW() - ((gs || ' days')::INTERVAL),
    ROUND(
        (5 + (gs * 2.35))::NUMERIC,
        2
    ),
    CASE
        WHEN gs % 3 = 0 THEN 'BAIXO'
        WHEN gs % 3 = 1 THEN 'MEDIO'
        ELSE 'ALTO'
    END,
    CASE
        WHEN gs % 4 = 0 THEN 'CHUVA'
        WHEN gs % 4 = 1 THEN 'SOL'
        WHEN gs % 4 = 2 THEN 'NUBLADO'
        ELSE 'TEMPESTADE'
    END,
    20 + ((gs * 7) % 180),
    CASE
        WHEN gs % 3 = 0 THEN 'v1'
        WHEN gs % 3 = 1 THEN 'v1.1'
        ELSE 'v2'
    END,
    ROUND(
        (100 + (gs * 137.55))::NUMERIC,
        2
    ),
    ROUND(
        (15 + (gs * 1.75))::NUMERIC,
        2
    ),
    CASE
        WHEN gs % 5 = 0 THEN 'Botucatu'
        WHEN gs % 5 = 1 THEN 'São Paulo'
        WHEN gs % 5 = 2 THEN 'Bauru'
        WHEN gs % 5 = 3 THEN 'Campinas'
        ELSE 'Sorocaba'
    END,
    'SP',
    LPAD((1000000 + gs)::TEXT, 8, '0'),
    CASE
        WHEN gs % 5 = 0 THEN 'Rio de Janeiro'
        WHEN gs % 5 = 1 THEN 'São Paulo'
        WHEN gs % 5 = 2 THEN 'Curitiba'
        WHEN gs % 5 = 3 THEN 'Belo Horizonte'
        ELSE 'Porto Alegre'
    END,
    CASE
        WHEN gs % 5 = 0 THEN 'RJ'
        WHEN gs % 5 = 1 THEN 'SP'
        WHEN gs % 5 = 2 THEN 'PR'
        WHEN gs % 5 = 3 THEN 'MG'
        ELSE 'RS'
    END,
    LPAD((2000000 + gs)::TEXT, 8, '0'),
    CASE
        WHEN gs % 5 = 0 THEN 'Eletronico'
        WHEN gs % 5 = 1 THEN 'Informatica'
        WHEN gs % 5 = 2 THEN 'Acessorios'
        WHEN gs % 5 = 3 THEN 'Telefonia'
        ELSE 'Hardware'
    END,
    500 + (gs * 125),
    10 + (gs % 50),
    5 + (gs % 30),
    10 + (gs % 40),
    (gs % 7) + 1,
    ((gs - 1) % 12) + 1,
    8 + (gs % 10),
    1 + (gs % 10)
FROM generate_series(1, 60) AS gs;
-- Pagamentos
INSERT INTO pagamento (
        id_pedido,
        tipo_pagamento,
        valor,
        status,
        data_pagamento
    )
SELECT gs,
    CASE
        WHEN gs % 4 = 0 THEN 'PIX'
        WHEN gs % 4 = 1 THEN 'CARTAO'
        WHEN gs % 4 = 2 THEN 'BOLETO'
        ELSE 'CARTAO'
    END,
    ROUND(
        (
            100 + (gs * 137.55) + ((gs % 7) * 49.90)
        )::NUMERIC,
        2
    ),
    CASE
        WHEN gs % 6 = 0 THEN 'PENDENTE'
        WHEN gs % 7 = 0 THEN 'CANCELADO'
        ELSE 'PAGO'
    END,
    CASE
        WHEN gs % 6 = 0 THEN NULL
        ELSE NOW() - ((gs || ' days')::INTERVAL)
    END
FROM generate_series(1, 60) AS gs;
-- Logs do sistema
INSERT INTO log_sistema (
        id_usuario,
        acao,
        entidade,
        ip
    )
SELECT 1 + (gs % 60),
    CASE
        WHEN gs % 8 = 0 THEN 'LOGIN'
        WHEN gs % 8 = 1 THEN 'CRIAR_PEDIDO'
        WHEN gs % 8 = 2 THEN 'ATUALIZAR_PEDIDO'
        WHEN gs % 8 = 3 THEN 'CRIAR_CLIENTE'
        WHEN gs % 8 = 4 THEN 'ATUALIZAR_CLIENTE'
        WHEN gs % 8 = 5 THEN 'CRIAR_PRODUTO'
        WHEN gs % 8 = 6 THEN 'ATUALIZAR_ESTOQUE'
        ELSE 'CONSULTAR_RELATORIO'
    END,
    CASE
        WHEN gs % 4 = 0 THEN 'usuario'
        WHEN gs % 4 = 1 THEN 'pedido'
        WHEN gs % 4 = 2 THEN 'cliente'
        ELSE 'produto'
    END,
    '127.0.0.' || ((gs % 254) + 1)
FROM generate_series(1, 60) AS gs;
-- Conferência dos dados
SELECT 'perfil' AS tabela,
    COUNT(*) AS registros
FROM perfil
UNION ALL
SELECT 'usuario',
    COUNT(*)
FROM usuario
UNION ALL
SELECT 'cliente',
    COUNT(*)
FROM cliente
UNION ALL
SELECT 'endereco',
    COUNT(*)
FROM endereco
UNION ALL
SELECT 'produto',
    COUNT(*)
FROM produto
UNION ALL
SELECT 'estoque',
    COUNT(*)
FROM estoque
UNION ALL
SELECT 'movimentacao_estoque',
    COUNT(*)
FROM movimentacao_estoque
UNION ALL
SELECT 'pedido',
    COUNT(*)
FROM pedido
UNION ALL
SELECT 'item_pedido',
    COUNT(*)
FROM item_pedido
UNION ALL
SELECT 'entrega',
    COUNT(*)
FROM entrega
UNION ALL
SELECT 'previsao_entrega',
    COUNT(*)
FROM previsao_entrega
UNION ALL
SELECT 'pagamento',
    COUNT(*)
FROM pagamento
UNION ALL
SELECT 'log_sistema',
    COUNT(*)
FROM log_sistema
ORDER BY tabela;
