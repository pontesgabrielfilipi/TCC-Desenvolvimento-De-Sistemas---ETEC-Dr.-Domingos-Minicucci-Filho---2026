-- Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
-- Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

-- Adota o fluxo de aprovação sem retirar o acesso dos usuários existentes.
-- O DEFAULT vale apenas para cadastros realizados depois desta migration.
ALTER TABLE agerp.usuario
    ADD COLUMN IF NOT EXISTS status_acesso VARCHAR(20);

UPDATE agerp.usuario
SET status_acesso = 'APROVADO'
WHERE status_acesso IS NULL;

ALTER TABLE agerp.usuario
    ALTER COLUMN status_acesso SET DEFAULT 'PENDENTE',
    ALTER COLUMN status_acesso SET NOT NULL;

ALTER TABLE agerp.usuario
    DROP CONSTRAINT IF EXISTS ck_usuario_status_acesso;

ALTER TABLE agerp.usuario
    ADD CONSTRAINT ck_usuario_status_acesso
    CHECK (status_acesso IN ('PENDENTE', 'APROVADO', 'BLOQUEADO', 'REJEITADO'));

CREATE INDEX IF NOT EXISTS idx_usuario_status_acesso
    ON agerp.usuario (status_acesso);
