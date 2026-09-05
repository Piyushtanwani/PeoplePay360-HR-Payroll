CREATE TABLE time_off_type (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name               TEXT NOT NULL,
    code               TEXT NOT NULL UNIQUE,
    unit               TEXT NOT NULL DEFAULT 'DAYS',
    is_paid            BOOLEAN NOT NULL DEFAULT TRUE,
    requires_allocation BOOLEAN NOT NULL DEFAULT TRUE,
    color              TEXT NOT NULL DEFAULT '#0A84FF',
    active             BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE public_holiday (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL
);

CREATE TABLE time_off_allocation (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    type_id     BIGINT NOT NULL REFERENCES time_off_type(id),
    days        NUMERIC(6,2) NOT NULL,
    valid_from  DATE,
    valid_to    DATE,
    state       TEXT NOT NULL DEFAULT 'DRAFT',
    approved_by BIGINT REFERENCES app_user(id),
    approved_at TIMESTAMPTZ,
    note        TEXT
);
CREATE INDEX idx_alloc_emp ON time_off_allocation(employee_id, state);

CREATE TABLE time_off_request (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id  BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    type_id      BIGINT NOT NULL REFERENCES time_off_type(id),
    start_date   DATE NOT NULL,
    end_date     DATE NOT NULL,
    days         NUMERIC(6,2) NOT NULL,
    state        TEXT NOT NULL DEFAULT 'PENDING',
    reason       TEXT,
    anomaly      TEXT,
    decided_by   BIGINT REFERENCES app_user(id),
    decided_at   TIMESTAMPTZ,
    decision_note TEXT,
    version      BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_request_emp ON time_off_request(employee_id, state, start_date);
