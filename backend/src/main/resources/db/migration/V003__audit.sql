CREATE TABLE audit_event (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_user_id  BIGINT,
    actor_name     TEXT,
    actor_roles    TEXT[] NOT NULL DEFAULT '{}',
    channel        TEXT NOT NULL,
    action         TEXT NOT NULL,
    resource_type  TEXT,
    resource_id    TEXT,
    outcome        TEXT NOT NULL,
    reason         TEXT,
    before_json    JSONB,
    after_json     JSONB,
    request_id     TEXT
);
CREATE INDEX idx_audit_occurred ON audit_event(occurred_at DESC);
CREATE INDEX idx_audit_actor ON audit_event(actor_user_id);
CREATE INDEX idx_audit_resource ON audit_event(resource_type, resource_id);
CREATE INDEX idx_audit_channel ON audit_event(channel);

CREATE OR REPLACE FUNCTION audit_append_only() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_event is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_audit_append_only BEFORE UPDATE OR DELETE ON audit_event
    FOR EACH ROW EXECUTE FUNCTION audit_append_only();
