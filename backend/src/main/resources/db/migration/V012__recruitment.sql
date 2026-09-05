CREATE TABLE job_opening (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title               TEXT NOT NULL,
    department_id       BIGINT REFERENCES department(id),
    salary_structure_id BIGINT REFERENCES salary_structure(id),
    working_schedule_id BIGINT REFERENCES working_schedule(id),
    band_min            NUMERIC(14,2),
    band_max            NUMERIC(14,2),
    target_start_date   DATE,
    criteria            JSONB NOT NULL DEFAULT '[]',
    status              TEXT NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE candidate (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    opening_id       BIGINT NOT NULL REFERENCES job_opening(id) ON DELETE CASCADE,
    display_code     TEXT NOT NULL,
    profile          JSONB NOT NULL DEFAULT '{}',
    expected_salary  NUMERIC(14,2),
    available_from   DATE,
    stage            TEXT NOT NULL DEFAULT 'NEW',
    hired_employee_id BIGINT REFERENCES employee(id),
    rejection_reason TEXT,
    version          BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_candidate_opening ON candidate(opening_id, stage);
CREATE UNIQUE INDEX uq_candidate_hired ON candidate(hired_employee_id) WHERE hired_employee_id IS NOT NULL;

CREATE TABLE candidate_identity (
    candidate_id BIGINT PRIMARY KEY REFERENCES candidate(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    email        TEXT,
    phone        TEXT
);

CREATE TABLE candidate_comparison (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    opening_id   BIGINT NOT NULL REFERENCES job_opening(id) ON DELETE CASCADE,
    candidate_ids BIGINT[] NOT NULL,
    rubric_version INT NOT NULL DEFAULT 1,
    weights      JSONB NOT NULL,
    result       JSONB NOT NULL,
    model        TEXT,
    prompt_version TEXT,
    requested_by BIGINT REFERENCES app_user(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE comparison_decision (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    comparison_id BIGINT NOT NULL REFERENCES candidate_comparison(id) ON DELETE CASCADE,
    candidate_id  BIGINT NOT NULL REFERENCES candidate(id),
    decision      TEXT NOT NULL,
    rationale     TEXT NOT NULL,
    decided_by    BIGINT REFERENCES app_user(id),
    decided_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decision_candidate ON comparison_decision(candidate_id);
