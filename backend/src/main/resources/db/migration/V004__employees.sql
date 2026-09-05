CREATE TABLE department (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE employee (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_no    TEXT NOT NULL UNIQUE,
    display_name   TEXT NOT NULL,
    work_email     TEXT,
    job_title      TEXT,
    hire_date      DATE,
    department_id  BIGINT REFERENCES department(id),
    employee_type  TEXT NOT NULL DEFAULT 'FULL_TIME',
    manager_id     BIGINT REFERENCES employee(id),
    user_id        BIGINT REFERENCES app_user(id),
    working_schedule_id BIGINT,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_employee_dept ON employee(department_id);
CREATE INDEX idx_employee_type ON employee(employee_type);
CREATE INDEX idx_employee_manager ON employee(manager_id);

ALTER TABLE app_user ADD CONSTRAINT fk_user_employee FOREIGN KEY (employee_id) REFERENCES employee(id);

CREATE TABLE employee_bank_account (
    employee_id       BIGINT PRIMARY KEY REFERENCES employee(id) ON DELETE CASCADE,
    bank_name         TEXT NOT NULL,
    account_last4     TEXT NOT NULL,
    account_encrypted TEXT NOT NULL,
    ifsc_encrypted    TEXT
);
