CREATE TABLE chat_session (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    title       TEXT,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at TIMESTAMPTZ,
    deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_chat_session_user ON chat_session(user_id) WHERE deleted_at IS NULL;

CREATE TABLE chat_message (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id  BIGINT NOT NULL REFERENCES chat_session(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    blocks_json JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_message_session ON chat_message(session_id, created_at);

CREATE TABLE chat_tool_call (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id    BIGINT NOT NULL REFERENCES chat_message(id) ON DELETE CASCADE,
    tool_name     TEXT NOT NULL,
    resource_type TEXT,
    resource_id   TEXT,
    prompt_hash   TEXT,
    allowed       BOOLEAN NOT NULL,
    denial_code   TEXT,
    http_status   INT,
    latency_ms    INT
);
