-- Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
-- Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

SELECT 'CREATE DATABASE agdb' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'agdb')\gexec

\c agdb

CREATE SCHEMA IF NOT EXISTS agerp;
SET search_path TO agerp, public;



SELECT u.email, p.nome as perfil
FROM agerp.usuario u
         JOIN agerp.perfil p ON u.id_perfil = p.id_perfil
WHERE u.email = 'admin@agerp.com';
