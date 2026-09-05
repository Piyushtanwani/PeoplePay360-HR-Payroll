CREATE TABLE working_schedule (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         TEXT NOT NULL,
    type         TEXT NOT NULL DEFAULT 'FIXED',
    weekly_hours NUMERIC(6,2) NOT NULL DEFAULT 0
);

CREATE TABLE working_schedule_line (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schedule_id   BIGINT NOT NULL REFERENCES working_schedule(id) ON DELETE CASCADE,
    day_of_week   INT NOT NULL,
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    break_minutes INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_schedule_line ON working_schedule_line(schedule_id);

ALTER TABLE employee ADD CONSTRAINT fk_employee_schedule FOREIGN KEY (working_schedule_id) REFERENCES working_schedule(id);
