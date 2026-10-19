
-- Credenciais chegam pelo ambiente do container e não ficam gravadas no script.
\getenv APP_USER APP_DB_USER
\getenv APP_PASSWORD APP_DB_PASSWORD
\getenv DB_NAME POSTGRES_DB

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'APP_USER', :'APP_PASSWORD')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'APP_USER')
\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'DB_NAME', :'APP_USER')
\gexec

-- Permissões no schema public
GRANT USAGE ON SCHEMA public TO :"APP_USER";

-- ====================== PERMISSÕES NO SCHEMA AGERP ======================

-- Garante que o schema existe
CREATE SCHEMA IF NOT EXISTS agerp;

-- Permissões no schema agerp
GRANT USAGE ON SCHEMA agerp TO :"APP_USER";

-- Permissões em todas as tabelas existentes
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA agerp TO :"APP_USER";

-- Permissões em todas as sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA agerp TO :"APP_USER";

-- Permissões padrão para objetos futuros (novas tabelas e sequences)
ALTER DEFAULT PRIVILEGES IN SCHEMA agerp
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"APP_USER";

ALTER DEFAULT PRIVILEGES IN SCHEMA agerp
    GRANT USAGE, SELECT ON SEQUENCES TO :"APP_USER";

-- Confirmação
\echo 'Permissões da aplicação configuradas no schema agerp.'
