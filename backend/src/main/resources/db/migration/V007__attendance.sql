CREATE TABLE attendance (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id      BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    work_date        DATE NOT NULL,
    check_in         TIMESTAMPTZ,
    check_out        TIMESTAMPTZ,
    worked_minutes   INT NOT NULL DEFAULT 0,
    scheduled_minutes INT NOT NULL DEFAULT 0,
    status           TEXT NOT NULL DEFAULT 'PRESENT',
    is_manual_edit   BOOLEAN NOT NULL DEFAULT FALSE,
    edited_by        BIGINT REFERENCES app_user(id),
    edit_reason      TEXT,
    original_check_out TIMESTAMPTZ,
    CONSTRAINT uq_attendance_checkin UNIQUE (employee_id, check_in)
);
CREATE INDEX idx_attendance_emp_date ON attendance(employee_id, work_date);
CREATE INDEX idx_attendance_open ON attendance(employee_id) WHERE check_out IS NULL;

CREATE TABLE attendance_exception (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id   BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    attendance_id BIGINT REFERENCES attendance(id) ON DELETE CASCADE,
    date          DATE NOT NULL,
    type          TEXT NOT NULL,
    minutes       INT NOT NULL DEFAULT 0,
    resolved      BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_exception_emp ON attendance_exception(employee_id, date);
