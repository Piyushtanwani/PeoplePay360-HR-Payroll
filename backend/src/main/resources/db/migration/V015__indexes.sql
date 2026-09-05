CREATE INDEX IF NOT EXISTS idx_user_role ON app_user(role_id);
CREATE INDEX IF NOT EXISTS idx_user_email ON app_user(lower(email));
CREATE INDEX IF NOT EXISTS idx_employee_email ON employee(lower(work_email));
CREATE INDEX IF NOT EXISTS idx_payrun_employee ON payrun_employee(employee_id);
