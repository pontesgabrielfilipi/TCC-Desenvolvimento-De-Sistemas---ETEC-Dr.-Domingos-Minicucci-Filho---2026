CREATE TABLE agerp.configuracao_sistema (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nome_empresa VARCHAR(100) NOT NULL,
    limite_estoque_baixo INTEGER NOT NULL CHECK (limite_estoque_baixo BETWEEN 1 AND 100000),
    exibir_alertas_estoque BOOLEAN NOT NULL,
    timeout_ia_ms INTEGER NOT NULL CHECK (timeout_ia_ms BETWEEN 500 AND 15000),
    versao BIGINT NOT NULL DEFAULT 0 CHECK (versao >= 0),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO agerp.configuracao_sistema
    (id, nome_empresa, limite_estoque_baixo, exibir_alertas_estoque, timeout_ia_ms)
VALUES (1, 'AGERP', 15, TRUE, 2000);
