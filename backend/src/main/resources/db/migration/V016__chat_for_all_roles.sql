-- The assistant is available to every signed-in user; only its configuration stays admin-only.
INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, 'chat.access' FROM role r
WHERE r.code IN ('EMPLOYEE', 'HR_MANAGER', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_USER')
ON CONFLICT DO NOTHING;
