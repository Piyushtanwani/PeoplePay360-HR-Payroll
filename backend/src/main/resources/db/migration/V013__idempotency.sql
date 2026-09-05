CREATE TABLE idempotency_record (
    user_id     BIGINT NOT NULL,
    idem_key    TEXT NOT NULL,
    http_status INT NOT NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, idem_key)
);
CREATE INDEX idx_idempotency_created ON idempotency_record(created_at);
