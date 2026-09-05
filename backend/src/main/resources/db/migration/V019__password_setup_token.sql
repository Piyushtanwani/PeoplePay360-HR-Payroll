-- Single-use, expiring token emailed to a new user so they choose their own password.
-- The raw token is never stored: only its SHA-256 hash, so a database leak cannot be replayed.
CREATE TABLE password_setup_token (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,
    purpose     TEXT        NOT NULL DEFAULT 'INVITE',
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_setup_token_user ON password_setup_token (user_id);
CREATE INDEX idx_password_setup_token_expiry ON password_setup_token (expires_at) WHERE used_at IS NULL;
