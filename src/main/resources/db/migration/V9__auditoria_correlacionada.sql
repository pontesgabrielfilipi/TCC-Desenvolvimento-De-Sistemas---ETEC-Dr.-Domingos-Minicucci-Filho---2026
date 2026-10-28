-- O TIMESTAMP histórico permanece intacto enquanto não houver origem confiável para o fuso.
ALTER TABLE agerp.log_sistema
    ADD COLUMN event_id UUID,
    ADD COLUMN request_id UUID,
    ADD COLUMN correlation_id VARCHAR(64),
    ADD COLUMN session_ref VARCHAR(100),
    ADD COLUMN device_ref VARCHAR(100),
    ADD COLUMN event_schema_version SMALLINT NOT NULL DEFAULT 1,
    ADD COLUMN peer_ip VARCHAR(50),
    ADD COLUMN user_agent VARCHAR(256),
    ADD COLUMN http_method VARCHAR(10),
    ADD COLUMN http_route VARCHAR(160),
    ADD COLUMN http_status INTEGER,
    ADD COLUMN duration_ms BIGINT,
    ADD COLUMN changes_json JSONB;

-- Eventos históricos mantêm event_id nulo; não se inventam identidade nem sessão para dados legados.
CREATE UNIQUE INDEX ux_log_sistema_event_id ON agerp.log_sistema(event_id)
    WHERE event_id IS NOT NULL;
CREATE INDEX ix_log_sistema_request_id ON agerp.log_sistema(request_id)
    WHERE request_id IS NOT NULL;
CREATE INDEX ix_log_sistema_correlation_id ON agerp.log_sistema(correlation_id)
    WHERE correlation_id IS NOT NULL;

-- Executa com o proprietário das migrations, não com a conta restrita da aplicação.
DO $$
DECLARE app_role TEXT := '${auditAppRole}';
BEGIN
    IF app_role IS NULL OR app_role = '' THEN
        RAISE EXCEPTION 'auditAppRole Flyway placeholder is required';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
        RAISE EXCEPTION 'Audit runtime role does not exist';
    END IF;
    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON agerp.log_sistema FROM %I', app_role);
    -- Privilégios concedidos a PUBLIC também são inseguros para uma tabela de auditoria.
    REVOKE UPDATE, DELETE, TRUNCATE ON agerp.log_sistema FROM PUBLIC;
END $$;
