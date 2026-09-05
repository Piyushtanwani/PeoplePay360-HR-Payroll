-- Indexes backing the default sort of every list endpoint. Without these, ordering a large table by
-- a non-indexed column forces a full sort on every page request.
CREATE INDEX IF NOT EXISTS idx_payslip_period_start   ON payslip(period_start DESC);
CREATE INDEX IF NOT EXISTS idx_payslip_emp_period_end ON payslip(employee_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_contract_start_date    ON contract(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_contract_structure     ON contract(salary_structure_id, state);
CREATE INDEX IF NOT EXISTS idx_attendance_date_emp    ON attendance(work_date DESC, employee_id);
CREATE INDEX IF NOT EXISTS idx_payrun_period_start    ON payrun(period_start DESC);
CREATE INDEX IF NOT EXISTS idx_request_start_date     ON time_off_request(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_allocation_valid_from  ON time_off_allocation(valid_from DESC);
CREATE INDEX IF NOT EXISTS idx_audit_outcome_time     ON audit_event(outcome, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_grant_expiry_live      ON user_permission_grant(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invite_open            ON password_setup_token(purpose, expires_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_structure_name_lower   ON salary_structure(lower(name));
CREATE INDEX IF NOT EXISTS idx_employee_name_lower    ON employee(lower(display_name));
