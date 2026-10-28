-- Mantém no evento o contexto mínimo do usuário no momento da ação.
-- As colunas continuam opcionais porque eventos de sistema podem não ter usuário.
ALTER TABLE agerp.log_sistema
    ADD COLUMN IF NOT EXISTS usuario_nome VARCHAR(150),
    ADD COLUMN IF NOT EXISTS usuario_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS usuario_perfil VARCHAR(100),
    ADD COLUMN IF NOT EXISTS recurso_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS resultado VARCHAR(50),
    ADD COLUMN IF NOT EXISTS detalhes TEXT;

-- Recupera o melhor contexto disponível para eventos anteriores. COALESCE preserva
-- snapshots já preenchidos caso a migration seja reaplicada manualmente.
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

-- Sustenta a ordenação padrão e a navegação estável entre páginas da auditoria.
CREATE INDEX IF NOT EXISTS idx_log_sistema_data_hora_id
    ON agerp.log_sistema (data_hora DESC, id_log DESC);

-- Evita varrer toda a tabela nas consultas de histórico por usuário.
CREATE INDEX IF NOT EXISTS idx_log_sistema_usuario_data
    ON agerp.log_sistema (id_usuario, data_hora DESC);

-- Trigramas permitem que a busca parcial case-insensitive, inclusive com curinga
-- no início, use índice em vez de varrer todo o histórico.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE INDEX IF NOT EXISTS idx_log_sistema_email_trgm
    ON agerp.log_sistema USING GIN (LOWER(usuario_email) public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_log_sistema_perfil_trgm
    ON agerp.log_sistema USING GIN (LOWER(usuario_perfil) public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_log_sistema_acao_trgm
    ON agerp.log_sistema USING GIN (LOWER(acao) public.gin_trgm_ops);
