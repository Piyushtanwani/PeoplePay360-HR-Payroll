CREATE TABLE ai_profile (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name              TEXT NOT NULL,
    provider          TEXT NOT NULL,
    base_url          TEXT NOT NULL,
    model             TEXT NOT NULL,
    api_key_encrypted TEXT,
    api_key_last4     TEXT,
    tool_mode         TEXT NOT NULL DEFAULT 'AUTO',
    temperature       NUMERIC(3,2) NOT NULL DEFAULT 0.20,
    max_tokens        INT NOT NULL DEFAULT 1024,
    is_default        BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_test_ok      BOOLEAN,
    last_test_at      TIMESTAMPTZ,
    last_test_message TEXT,
    version           BIGINT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX uq_ai_default ON ai_profile(is_default) WHERE is_default = TRUE;
