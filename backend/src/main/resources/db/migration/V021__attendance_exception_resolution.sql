-- Who resolved an attendance exception, when, and why. The resolve endpoint previously flipped a
-- boolean and discarded the reason onto the audit row only, leaving the record itself unexplained.
ALTER TABLE attendance_exception
    ADD COLUMN resolved_by     BIGINT REFERENCES app_user(id),
    ADD COLUMN resolved_at     TIMESTAMPTZ,
    ADD COLUMN resolution_note TEXT;

-- Exceptions are now created by both the nightly job and the on-demand recompute, so they must be
-- idempotent. Collapse any pre-existing duplicates before the unique indexes are added.
DELETE FROM attendance_exception a
 USING attendance_exception b
 WHERE a.id > b.id
   AND a.employee_id = b.employee_id
   AND a.date = b.date
   AND a.type = b.type;

CREATE UNIQUE INDEX uq_exception_emp_date_type ON attendance_exception(employee_id, date, type);
CREATE INDEX idx_exception_type_resolved_date ON attendance_exception(type, resolved, date DESC);
