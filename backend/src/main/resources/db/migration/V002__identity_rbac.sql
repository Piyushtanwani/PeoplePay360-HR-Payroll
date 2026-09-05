CREATE TABLE role (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code      TEXT NOT NULL UNIQUE,
    name      TEXT NOT NULL
);

CREATE TABLE permission (
    code      TEXT PRIMARY KEY,
    resource  TEXT NOT NULL,
    action    TEXT NOT NULL,
    scope     TEXT,
    tier      TEXT NOT NULL DEFAULT 'NORMAL',
    grantable BOOLEAN NOT NULL DEFAULT TRUE,
    implies   TEXT[] NOT NULL DEFAULT '{}',
    description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE app_user (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    role_id       BIGINT NOT NULL REFERENCES role(id),
    employee_id   BIGINT,
    perm_version  INT NOT NULL DEFAULT 1,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    is_break_glass BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permission (
    role_id         BIGINT NOT NULL REFERENCES role(id) ON DELETE CASCADE,
    permission_code TEXT NOT NULL REFERENCES permission(code) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE user_permission_grant (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    permission_code TEXT NOT NULL REFERENCES permission(code),
    effect          TEXT NOT NULL DEFAULT 'ALLOW',
    reason          TEXT NOT NULL,
    granted_by      BIGINT NOT NULL REFERENCES app_user(id),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    CONSTRAINT grant_not_self CHECK (granted_by <> user_id)
);
CREATE INDEX idx_grant_active ON user_permission_grant(user_id) WHERE revoked_at IS NULL;

-- Break-glass admin cannot be deactivated or deleted
CREATE OR REPLACE FUNCTION protect_break_glass() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD.is_break_glass THEN
        RAISE EXCEPTION 'break-glass user cannot be deleted';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.is_break_glass AND NEW.active = FALSE THEN
        RAISE EXCEPTION 'break-glass user cannot be deactivated';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_protect_break_glass BEFORE UPDATE OR DELETE ON app_user
    FOR EACH ROW EXECUTE FUNCTION protect_break_glass();

-- Effective permission view: role perms UNION active ALLOW grants EXCEPT active DENY grants, then implies expanded
CREATE OR REPLACE VIEW v_effective_permission AS
WITH base AS (
    SELECT u.id AS user_id, rp.permission_code
    FROM app_user u
    JOIN role_permission rp ON rp.role_id = u.role_id
    UNION
    SELECT g.user_id, g.permission_code
    FROM user_permission_grant g
    WHERE g.effect = 'ALLOW'
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
),
denied AS (
    SELECT g.user_id, g.permission_code
    FROM user_permission_grant g
    WHERE g.effect = 'DENY'
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
),
granted AS (
    SELECT b.user_id, b.permission_code
    FROM base b
    WHERE NOT EXISTS (
        SELECT 1 FROM denied d WHERE d.user_id = b.user_id AND d.permission_code = b.permission_code
    )
),
expanded AS (
    SELECT user_id, permission_code FROM granted
    UNION
    SELECT gr.user_id, implied AS permission_code
    FROM granted gr
    JOIN permission p ON p.code = gr.permission_code
    CROSS JOIN LATERAL unnest(p.implies) AS implied
)
SELECT DISTINCT user_id, permission_code FROM expanded;
