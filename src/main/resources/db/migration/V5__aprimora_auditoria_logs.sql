-- Mantem no proprio evento o contexto minimo do usuario no momento da acao.
-- As colunas permanecem opcionais porque eventos de sistema podem nao ter usuario.
ALTER TABLE agerp.log_sistema
    ADD COLUMN IF NOT EXISTS usuario_nome VARCHAR(150),
    ADD COLUMN IF NOT EXISTS usuario_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS usuario_perfil VARCHAR(100),
    ADD COLUMN IF NOT EXISTS recurso_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS resultado VARCHAR(50),
    ADD COLUMN IF NOT EXISTS detalhes TEXT;

-- Recupera o melhor contexto disponivel para os eventos anteriores. COALESCE
-- evita alterar snapshots caso a migration seja reaplicada manualmente.
UPDATE agerp.log_sistema AS log
SET usuario_nome = COALESCE(log.usuario_nome, usuario.nome),
    usuario_email = COALESCE(log.usuario_email, usuario.email),
    usuario_perfil = COALESCE(log.usuario_perfil, perfil.nome)
FROM agerp.usuario AS usuario
LEFT JOIN agerp.perfil AS perfil
    ON perfil.id_perfil = usuario.id_perfil
WHERE log.id_usuario = usuario.id_usuario
  AND (log.usuario_nome IS NULL
       OR log.usuario_email IS NULL
       OR log.usuario_perfil IS NULL);

-- Ordenacao padrao da auditoria e navegacao estavel entre paginas.
CREATE INDEX IF NOT EXISTS idx_log_sistema_data_hora_id
    ON agerp.log_sistema (data_hora DESC, id_log DESC);

-- Consultas de historico por usuario sem carregar toda a tabela.
CREATE INDEX IF NOT EXISTS idx_log_sistema_usuario_data
    ON agerp.log_sistema (id_usuario, data_hora DESC);

-- Trigramas permitem que a pesquisa parcial case-insensitive (inclusive com
-- curinga no inicio) use indice, em vez de varrer integralmente o historico.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE INDEX IF NOT EXISTS idx_log_sistema_email_trgm
    ON agerp.log_sistema USING GIN (LOWER(usuario_email) public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_log_sistema_perfil_trgm
    ON agerp.log_sistema USING GIN (LOWER(usuario_perfil) public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_log_sistema_acao_trgm
    ON agerp.log_sistema USING GIN (LOWER(acao) public.gin_trgm_ops);
