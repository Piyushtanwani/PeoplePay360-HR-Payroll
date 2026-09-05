-- Onboarding moved to the employee form: choosing a role there creates the login and emails the
-- invite. HR therefore needs to create users and assign roles.
--
-- Deliberately NOT granted: user.read, which gates the whole Admin area, and permission.grant.
-- AdminUserService additionally refuses to create or assign the ADMIN role unless the caller is an
-- administrator, so this cannot be used to escalate.
INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, c
  FROM role r
  CROSS JOIN unnest(ARRAY['user.create', 'user.update', 'role.assign']::text[]) AS c
 WHERE r.code IN ('HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER')
ON CONFLICT DO NOTHING;
