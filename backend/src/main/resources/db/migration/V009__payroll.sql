CREATE TABLE salary_rule (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    structure_id   BIGINT NOT NULL REFERENCES salary_structure(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    code           TEXT NOT NULL,
    category       TEXT NOT NULL,
    sequence       INT NOT NULL,
    compute_type   TEXT NOT NULL,
    fixed_amount   NUMERIC(14,2),
    percentage     NUMERIC(6,3),
    base_rule_code TEXT,
    formula        TEXT,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    description    TEXT,
    CONSTRAINT uq_rule_code UNIQUE (structure_id, code),
    CONSTRAINT uq_rule_seq UNIQUE (structure_id, sequence)
);

CREATE TABLE salary_structure_version (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    structure_id BIGINT NOT NULL REFERENCES salary_structure(id),
    version_no   INT NOT NULL,
    snapshot     JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payrun (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         TEXT NOT NULL,
    structure_id BIGINT NOT NULL REFERENCES salary_structure(id),
    period_start DATE NOT NULL,
    period_end   DATE NOT NULL,
    state        TEXT NOT NULL DEFAULT 'DRAFT',
    created_by   BIGINT REFERENCES app_user(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    computed_at  TIMESTAMPTZ,
    validated_by BIGINT REFERENCES app_user(id),
    validated_at TIMESTAMPTZ,
    paid_by      BIGINT REFERENCES app_user(id),
    paid_at      TIMESTAMPTZ,
    sent_at      TIMESTAMPTZ,
    version      BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_payrun_period ON payrun(period_start, period_end);
CREATE INDEX idx_payrun_state ON payrun(state);

CREATE TABLE payrun_employee (
    payrun_id   BIGINT NOT NULL REFERENCES payrun(id) ON DELETE CASCADE,
    employee_id BIGINT NOT NULL REFERENCES employee(id),
    PRIMARY KEY (payrun_id, employee_id)
);

CREATE TABLE payrun_input (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payrun_id   BIGINT NOT NULL REFERENCES payrun(id) ON DELETE CASCADE,
    employee_id BIGINT NOT NULL REFERENCES employee(id),
    code        TEXT NOT NULL,
    value       NUMERIC(14,2) NOT NULL,
    source      TEXT NOT NULL DEFAULT 'COMPUTED',
    CONSTRAINT uq_payrun_input UNIQUE (payrun_id, employee_id, code)
);

CREATE TABLE payslip (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payrun_id          BIGINT NOT NULL REFERENCES payrun(id) ON DELETE CASCADE,
    employee_id        BIGINT NOT NULL REFERENCES employee(id),
    contract_id        BIGINT REFERENCES contract(id),
    structure_version_id BIGINT REFERENCES salary_structure_version(id),
    period_start       DATE NOT NULL,
    period_end         DATE NOT NULL,
    worked_days        NUMERIC(6,2) NOT NULL DEFAULT 0,
    scheduled_days     NUMERIC(6,2) NOT NULL DEFAULT 0,
    unpaid_days        NUMERIC(6,2) NOT NULL DEFAULT 0,
    basic              NUMERIC(14,2) NOT NULL DEFAULT 0,
    allowances         NUMERIC(14,2) NOT NULL DEFAULT 0,
    deductions         NUMERIC(14,2) NOT NULL DEFAULT 0,
    gross              NUMERIC(14,2) NOT NULL DEFAULT 0,
    net                NUMERIC(14,2) NOT NULL DEFAULT 0,
    note               TEXT,
    CONSTRAINT uq_payslip_period UNIQUE (employee_id, period_start, period_end)
);
CREATE INDEX idx_payslip_payrun ON payslip(payrun_id);

CREATE TABLE payslip_line (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payslip_id  BIGINT NOT NULL REFERENCES payslip(id) ON DELETE CASCADE,
    rule_id     BIGINT,
    rule_code   TEXT NOT NULL,
    rule_name   TEXT NOT NULL,
    category    TEXT NOT NULL,
    sequence    INT NOT NULL,
    amount      NUMERIC(14,2) NOT NULL
);
CREATE INDEX idx_payslip_line ON payslip_line(payslip_id);

CREATE TABLE payslip_input (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payslip_id BIGINT NOT NULL REFERENCES payslip(id) ON DELETE CASCADE,
    code       TEXT NOT NULL,
    value      NUMERIC(14,2) NOT NULL,
    source     TEXT NOT NULL
);

CREATE TABLE payrun_issue (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payrun_id      BIGINT NOT NULL REFERENCES payrun(id) ON DELETE CASCADE,
    employee_id    BIGINT REFERENCES employee(id),
    check_code     TEXT NOT NULL,
    severity       TEXT NOT NULL,
    overridable    BOOLEAN NOT NULL,
    message        TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'OPEN',
    override_reason TEXT,
    resolved_by    BIGINT REFERENCES app_user(id),
    fix_link       TEXT
);
CREATE INDEX idx_issue_payrun ON payrun_issue(payrun_id, severity, status);

CREATE TABLE payslip_delivery (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payslip_id  BIGINT NOT NULL UNIQUE REFERENCES payslip(id) ON DELETE CASCADE,
    recipient   TEXT,
    channel     TEXT NOT NULL DEFAULT 'EMAIL',
    status      TEXT NOT NULL DEFAULT 'NOT_SENT',
    attempts    INT NOT NULL DEFAULT 0,
    last_error  TEXT,
    sent_at     TIMESTAMPTZ,
    pdf_sha256  TEXT
);

-- Block updates to payslip and payslip_line once the parent payrun is VALIDATED or later
CREATE OR REPLACE FUNCTION payslip_immutable() RETURNS TRIGGER AS $$
DECLARE
    st TEXT;
    pid BIGINT;
BEGIN
    pid := COALESCE(NEW.payrun_id, OLD.payrun_id);
    IF pid IS NULL THEN
        SELECT p.payrun_id INTO pid FROM payslip p WHERE p.id = COALESCE(NEW.payslip_id, OLD.payslip_id);
    END IF;
    SELECT state INTO st FROM payrun WHERE id = pid;
    IF st IN ('VALIDATED','PAID','SENT') THEN
        RAISE EXCEPTION 'payslip is immutable once the payrun is validated';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_payslip_immutable BEFORE UPDATE ON payslip
    FOR EACH ROW EXECUTE FUNCTION payslip_immutable();
CREATE TRIGGER trg_payslip_line_immutable BEFORE UPDATE ON payslip_line
    FOR EACH ROW EXECUTE FUNCTION payslip_immutable();
