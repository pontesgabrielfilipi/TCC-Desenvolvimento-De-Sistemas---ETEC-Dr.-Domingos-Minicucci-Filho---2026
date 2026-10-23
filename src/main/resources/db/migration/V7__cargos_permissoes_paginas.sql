-- Preserva os IDs dos perfis e todas as FKs existentes em agerp.usuario.
ALTER TABLE agerp.perfil
    ADD COLUMN nivel_autoridade INTEGER NOT NULL DEFAULT 20,
    ADD COLUMN protegido BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN versao BIGINT NOT NULL DEFAULT 0;

UPDATE agerp.perfil SET nivel_autoridade = CASE UPPER(nome)
    WHEN 'ADMIN' THEN 100 WHEN 'GERENTE' THEN 60
    WHEN 'FINANCEIRO' THEN 30 WHEN 'OPERADOR' THEN 10 ELSE 20 END,
    protegido = UPPER(nome) IN ('ADMIN', 'OPERADOR');

INSERT INTO agerp.perfil (nome, descricao, nivel_autoridade, protegido)
SELECT p.nome, p.descricao, p.nivel, p.protegido
FROM (VALUES ('ADMIN', 'Administrador do sistema', 100, TRUE),
             ('OPERADOR', 'Operador do sistema', 10, TRUE),
             ('GERENTE', 'Gerente', 60, FALSE),
             ('FINANCEIRO', 'Financeiro', 30, FALSE)) AS p(nome, descricao, nivel, protegido)
WHERE NOT EXISTS (SELECT 1 FROM agerp.perfil x WHERE UPPER(x.nome) = p.nome);

ALTER TABLE agerp.perfil ADD CONSTRAINT ck_perfil_nivel CHECK (nivel_autoridade BETWEEN 1 AND 100);

CREATE TABLE agerp.perfil_pagina (
    id_perfil INTEGER NOT NULL REFERENCES agerp.perfil(id_perfil) ON DELETE CASCADE,
    pagina VARCHAR(30) NOT NULL,
    PRIMARY KEY (id_perfil, pagina),
    CONSTRAINT ck_perfil_pagina CHECK (pagina IN ('DASHBOARD', 'CLIENTES', 'PRODUTOS', 'PEDIDOS', 'ADMIN'))
);

-- Retrocompatibilidade: todas as funções existentes mantêm as páginas operacionais.
INSERT INTO agerp.perfil_pagina (id_perfil, pagina)
SELECT p.id_perfil, pg.pagina FROM agerp.perfil p
CROSS JOIN (VALUES ('DASHBOARD'), ('CLIENTES'), ('PRODUTOS'), ('PEDIDOS')) pg(pagina);
INSERT INTO agerp.perfil_pagina (id_perfil, pagina)
SELECT id_perfil, 'ADMIN' FROM agerp.perfil WHERE UPPER(nome) = 'ADMIN';
