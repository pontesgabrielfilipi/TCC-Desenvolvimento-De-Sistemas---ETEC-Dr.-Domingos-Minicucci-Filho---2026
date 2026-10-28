-- Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
-- Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

-- Compatibilidade: antes desta migration, todos os indicadores usavam o limite geral.
-- O valor individual de cada estoque permanece intacto para permitir alternância.
ALTER TABLE agerp.configuracao_sistema
    ADD COLUMN usar_estoque_minimo_geral BOOLEAN NOT NULL DEFAULT TRUE;
