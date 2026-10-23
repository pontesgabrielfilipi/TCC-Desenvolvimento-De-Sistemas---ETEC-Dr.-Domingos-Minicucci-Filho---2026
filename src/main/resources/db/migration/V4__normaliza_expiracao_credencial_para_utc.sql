-- Instant representa um ponto absoluto no tempo. Valores legados sem fuso foram
-- gravados pela aplicacao em UTC, portanto a conversao explicita preserva o instante.
ALTER TABLE agerp.usuario
    ALTER COLUMN credencial_temporaria_expira_em
    TYPE TIMESTAMP WITH TIME ZONE
    USING credencial_temporaria_expira_em AT TIME ZONE 'UTC';
