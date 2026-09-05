-- Reusable contract templates. Creating an employee can pick one, and the backend then creates and
-- activates a real contract from it, so payroll always reads a contract and never a template.
CREATE TABLE contract_template (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                TEXT NOT NULL UNIQUE,
    wage                NUMERIC(14,2) NOT NULL,
    wage_type           TEXT NOT NULL DEFAULT 'MONTHLY',
    working_schedule_id BIGINT REFERENCES working_schedule(id),
    salary_structure_id BIGINT REFERENCES salary_structure(id),
    job_title           TEXT,
    description         TEXT,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contract_template_active ON contract_template(active);
