-- Suporta redefinicao administrativa sem armazenar a credencial temporaria em texto puro.
-- Usuarios existentes mantem a senha, a aprovacao e o estado de ativacao atuais.
ALTER TABLE agerp.usuario
    ADD COLUMN IF NOT EXISTS credential_version BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS troca_senha_obrigatoria BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS credencial_temporaria_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS credencial_temporaria_expira_em TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS credencial_temporaria_usada_em TIMESTAMP WITH TIME ZONE;

ALTER TABLE agerp.usuario
    DROP CONSTRAINT IF EXISTS ck_usuario_credential_version,
    DROP CONSTRAINT IF EXISTS ck_usuario_credencial_temporaria_consistente;

ALTER TABLE agerp.usuario
    ADD CONSTRAINT ck_usuario_credential_version
        CHECK (credential_version >= 0),
    ADD CONSTRAINT ck_usuario_credencial_temporaria_consistente
        CHECK (
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
        );

-- Facilita a busca de credenciais temporarias ainda nao consumidas para expiracao/limpeza.
CREATE INDEX IF NOT EXISTS idx_usuario_credencial_temporaria_ativa
    ON agerp.usuario (credencial_temporaria_expira_em)
    WHERE credencial_temporaria_hash IS NOT NULL
      AND credencial_temporaria_usada_em IS NULL;

COMMENT ON COLUMN agerp.usuario.credential_version IS
    'Versao incrementada a cada redefinicao/troca para invalidar JWTs anteriores.';
COMMENT ON COLUMN agerp.usuario.credencial_temporaria_hash IS
    'Hash PasswordEncoder da credencial temporaria; nunca armazena o valor em texto puro.';
