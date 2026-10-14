-- =============================================
-- CREATE_USER.SQL - CRIAÇÃO DO USUÁRIO E PERMISSÕES
-- =============================================

-- Cria o usuário da aplicação (se não existir)
DO $$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aguser') THEN
            CREATE USER aguser WITH PASSWORD 'agpass';
            RAISE NOTICE 'Usuário aguser criado com sucesso.';
        ELSE
            RAISE NOTICE 'Usuário aguser já existe.';
        END IF;
    END
$$;

-- Permissões básicas no banco
GRANT ALL PRIVILEGES ON DATABASE :DBNAME TO aguser;

-- Permissões no schema public
GRANT ALL ON SCHEMA public TO aguser;

-- ====================== PERMISSÕES NO SCHEMA AGERP ======================

-- Garante que o schema existe
CREATE SCHEMA IF NOT EXISTS agerp;

-- Permissões no schema agerp
GRANT ALL ON SCHEMA agerp TO aguser;

-- Permissões em todas as tabelas existentes
GRANT ALL ON ALL TABLES IN SCHEMA agerp TO aguser;

-- Permissões em todas as sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA agerp TO aguser;

-- Permissões padrão para objetos futuros (novas tabelas e sequences)
ALTER DEFAULT PRIVILEGES IN SCHEMA agerp
    GRANT ALL ON TABLES TO aguser;

ALTER DEFAULT PRIVILEGES IN SCHEMA agerp
    GRANT ALL ON SEQUENCES TO aguser;

-- Confirmação
\echo '✅ Permissões concedidas com sucesso para o usuário aguser no schema agerp.'
