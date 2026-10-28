-- Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
-- Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

-- O entrypoint oficial já conecta no banco definido por POSTGRES_DB.
CREATE SCHEMA IF NOT EXISTS agerp;
SET search_path TO agerp,
    public;
-- Perfis
CREATE TABLE perfil (
    id_perfil SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT
);
-- Usuários
CREATE TABLE usuario (
    id_usuario SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    credential_version BIGINT NOT NULL DEFAULT 0,
    troca_senha_obrigatoria BOOLEAN NOT NULL DEFAULT FALSE,
    credencial_temporaria_hash VARCHAR(255),
    credencial_temporaria_expira_em TIMESTAMP WITH TIME ZONE,
    credencial_temporaria_usada_em TIMESTAMP WITH TIME ZONE,
    ativo BOOLEAN DEFAULT TRUE,
    status_acesso VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_perfil INT NOT NULL,
    CONSTRAINT ck_usuario_status_acesso CHECK (
        status_acesso IN (
            'PENDENTE',
            'APROVADO',
            'BLOQUEADO',
            'REJEITADO'
        )
    ),
    CONSTRAINT ck_usuario_credential_version CHECK (credential_version >= 0),
    CONSTRAINT ck_usuario_credencial_temporaria_consistente CHECK (
        (
            credencial_temporaria_hash IS NULL
            AND credencial_temporaria_expira_em IS NULL
            AND credencial_temporaria_usada_em IS NULL
        )
        OR
        (
            credencial_temporaria_hash IS NOT NULL
            AND credencial_temporaria_expira_em IS NOT NULL
            AND troca_senha_obrigatoria
        )
    ),
    CONSTRAINT fk_usuario_perfil FOREIGN KEY (id_perfil) REFERENCES perfil(id_perfil)
);
-- Clientes
CREATE TABLE cliente (
    id_cliente SERIAL PRIMARY KEY,
    tipo VARCHAR(20),
    nome_razao VARCHAR(200),
    cpf_cnpj VARCHAR(20),
    email VARCHAR(150),
    telefone VARCHAR(20),
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Endereços
CREATE TABLE endereco (
    id_endereco SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL,
    logradouro VARCHAR(200),
    numero VARCHAR(20),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(50),
    cep VARCHAR(20),
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    CONSTRAINT fk_endereco_cliente FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente)
);
-- Produtos
CREATE TABLE produto (
    id_produto SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT,
    preco NUMERIC(10, 2),
    custo NUMERIC(10, 2),
    peso NUMERIC(10, 2),
    volume NUMERIC(10, 2),
    ativo BOOLEAN DEFAULT TRUE
);
-- Estoque
CREATE TABLE estoque (
    id_estoque SERIAL PRIMARY KEY,
    id_produto INT UNIQUE NOT NULL,
    quantidade_atual INT,
    quantidade_minima INT,
    localizacao VARCHAR(100),
    CONSTRAINT fk_estoque_produto FOREIGN KEY (id_produto) REFERENCES produto(id_produto)
);
-- Movimentações de estoque
CREATE TABLE movimentacao_estoque (
    id_movimentacao SERIAL PRIMARY KEY,
    id_produto INT NOT NULL,
    tipo VARCHAR(50),
    quantidade INT,
    data_movimentacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_usuario INT,
    CONSTRAINT fk_mov_produto FOREIGN KEY (id_produto) REFERENCES produto(id_produto),
    CONSTRAINT fk_mov_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);
-- Pedidos
CREATE TABLE pedido (
    id_pedido SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL,
    data_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50),
    valor_total NUMERIC(12, 2),
    observacoes TEXT,
    id_usuario INT,
    id_endereco INT,
    CONSTRAINT fk_pedido_cliente FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    CONSTRAINT fk_pedido_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_pedido_endereco FOREIGN KEY (id_endereco) REFERENCES endereco(id_endereco)
);
-- Itens de pedido
CREATE TABLE item_pedido (
    id_item SERIAL PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_produto INT NOT NULL,
    quantidade INT,
    preco_unitario NUMERIC(10, 2),
    CONSTRAINT fk_item_pedido FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido),
    CONSTRAINT fk_item_produto FOREIGN KEY (id_produto) REFERENCES produto(id_produto)
);
-- Entregas
CREATE TABLE entrega (
    id_entrega SERIAL PRIMARY KEY,
    id_pedido INT UNIQUE NOT NULL,
    data_saida TIMESTAMP,
    data_entrega TIMESTAMP,
    status VARCHAR(50),
    tempo_estimado_ia INT,
    tempo_real INT,
    distancia_km NUMERIC(10, 2),
    CONSTRAINT fk_entrega_pedido FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
);
-- Previsões de entrega
CREATE TABLE previsao_entrega (
    id_previsao SERIAL PRIMARY KEY,
    id_entrega INT UNIQUE NOT NULL,
    data_calculo TIMESTAMP,
    distancia NUMERIC(10, 2),
    transito_estimado VARCHAR(100),
    clima VARCHAR(100),
    tempo_previsto_min INT,
    modelo_versao VARCHAR(50),
    price NUMERIC(10, 2),
    freight_value NUMERIC(10, 2),
    customer_city varchar(150),
    customer_state varchar(2),
    customer_cep varchar(11),
    seller_city varchar(150),
    seller_state varchar(2),
    seller_cep varchar(11),
    product_category_name VARCHAR(100),
    product_weight_g NUMERIC(10, 2),
    product_length_cm NUMERIC(10, 2),
    product_height_cm NUMERIC(10, 2),
    product_width_cm NUMERIC(10, 2),
    order_weekday INT,
    order_month INT,
    order_hour INT,
    prazo_entrega_dias INT,
    CONSTRAINT fk_previsao_entrega FOREIGN KEY (id_entrega) REFERENCES entrega(id_entrega)
);
-- Pagamentos
CREATE TABLE pagamento (
    id_pagamento SERIAL PRIMARY KEY,
    id_pedido INT NOT NULL,
    tipo_pagamento VARCHAR(50),
    valor NUMERIC(10, 2),
    status VARCHAR(50),
    data_pagamento TIMESTAMP,
    CONSTRAINT fk_pagamento_pedido FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
);
-- Logs do sistema
CREATE TABLE log_sistema (
    id_log SERIAL PRIMARY KEY,
    id_usuario INT,
    acao VARCHAR(100),
    entidade VARCHAR(100),
    data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip VARCHAR(50),
    CONSTRAINT fk_log_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);
