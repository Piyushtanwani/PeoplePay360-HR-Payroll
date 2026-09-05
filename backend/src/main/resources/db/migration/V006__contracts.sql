CREATE TABLE salary_structure (
    id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name   TEXT NOT NULL,
    code   TEXT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE contract (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference           TEXT NOT NULL UNIQUE,
    employee_id         BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    wage                NUMERIC(14,2) NOT NULL,
    wage_type           TEXT NOT NULL DEFAULT 'MONTHLY',
    start_date          DATE NOT NULL,
    end_date            DATE,
    state               TEXT NOT NULL DEFAULT 'DRAFT',
    working_schedule_id BIGINT REFERENCES working_schedule(id),
    salary_structure_id BIGINT REFERENCES salary_structure(id),
    job_title           TEXT,
    department_id       BIGINT REFERENCES department(id),
    source_offer_id     BIGINT,
    version             BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT contract_no_overlap EXCLUDE USING gist (
        employee_id WITH =,
        daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]') WITH &&
    ) WHERE (state IN ('DRAFT','RUNNING'))
);
CREATE INDEX idx_contract_employee ON contract(employee_id);
CREATE INDEX idx_contract_state ON contract(state);
CREATE INDEX idx_contract_end ON contract(end_date);
