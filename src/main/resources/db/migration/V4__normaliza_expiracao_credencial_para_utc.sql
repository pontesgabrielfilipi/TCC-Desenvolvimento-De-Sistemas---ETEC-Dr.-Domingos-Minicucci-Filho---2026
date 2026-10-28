-- Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
-- Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

-- Os valores legados sem fuso foram gravados em UTC; a conversão explícita preserva o instante.
ALTER TABLE agerp.usuario
    ALTER COLUMN credencial_temporaria_expira_em
    TYPE TIMESTAMP WITH TIME ZONE
    USING credencial_temporaria_expira_em AT TIME ZONE 'UTC';
