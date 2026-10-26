CREATE TABLE agerp.sessao_autenticacao (
    id UUID PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES agerp.usuario(id_usuario),
    device_ref UUID,
    criada_em TIMESTAMPTZ NOT NULL,
    expira_em TIMESTAMPTZ NOT NULL,
    revogada_em TIMESTAMPTZ,
    motivo_revogacao VARCHAR(40)
);
CREATE INDEX ix_sessao_usuario_estado ON agerp.sessao_autenticacao(id_usuario, revogada_em);
CREATE INDEX ix_sessao_expiracao ON agerp.sessao_autenticacao(expira_em);
