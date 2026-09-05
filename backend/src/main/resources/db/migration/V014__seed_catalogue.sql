-- Generated: permission catalogue, roles, role_permission mappings (matches Part B5)

INSERT INTO permission (code, resource, action, scope, tier, grantable, implies, description) VALUES
  ('employee.read.own','employee','read','own','NORMAL',true,'{}','View own employee record'),
  ('employee.read.all','employee','read','all','NORMAL',true,ARRAY['employee.read.own']::text[],'View all employees'),
  ('employee.read.sensitive','employee','read','sensitive','NORMAL',true,'{}','Unmask bank account (audited)'),
  ('employee.create.all','employee','create','all','NORMAL',true,'{}','Create employees'),
  ('employee.update.all','employee','update','all','NORMAL',true,'{}','Update employees'),
  ('employee.delete.all','employee','delete','all','NORMAL',true,'{}','Deactivate employees'),
  ('contract.read.own','contract','read','own','NORMAL',true,'{}','View own contract (no wage)'),
  ('contract.read.all','contract','read','all','NORMAL',true,ARRAY['contract.read.own']::text[],'View all contracts'),
  ('contract.create.all','contract','create','all','NORMAL',true,'{}','Create contracts'),
  ('contract.update.all','contract','update','all','NORMAL',true,'{}','Update contracts'),
  ('contract.delete.all','contract','delete','all','NORMAL',true,'{}','Delete draft contracts'),
  ('contract.activate','contract','activate',NULL,'NORMAL',true,'{}','Activate a contract'),
  ('schedule.read.all','schedule','read','all','NORMAL',true,'{}','View working schedules'),
  ('schedule.create.all','schedule','create','all','NORMAL',true,'{}','Create schedules'),
  ('schedule.update.all','schedule','update','all','NORMAL',true,'{}','Update schedules'),
  ('schedule.delete.all','schedule','delete','all','NORMAL',true,'{}','Delete schedules'),
  ('attendance.read.own','attendance','read','own','NORMAL',true,'{}','View own attendance'),
  ('attendance.read.all','attendance','read','all','NORMAL',true,ARRAY['attendance.read.own']::text[],'View all attendance'),
  ('attendance.create.own','attendance','create','own','NORMAL',true,'{}','Check in and out'),
  ('attendance.create.all','attendance','create','all','NORMAL',true,'{}','Create attendance for anyone'),
  ('attendance.update.all','attendance','update','all','NORMAL',true,'{}','Correct attendance'),
  ('attendance.delete.all','attendance','delete','all','NORMAL',true,'{}','Delete attendance'),
  ('timeoff_type.read','timeoff_type','read',NULL,'NORMAL',true,'{}','View leave types'),
  ('timeoff_type.manage','timeoff_type','manage',NULL,'NORMAL',true,'{}','Manage leave types and holidays'),
  ('timeoff_request.read.own','timeoff_request','read','own','NORMAL',true,'{}','View own requests'),
  ('timeoff_request.read.all','timeoff_request','read','all','NORMAL',true,ARRAY['timeoff_request.read.own']::text[],'View all requests'),
  ('timeoff_request.create.own','timeoff_request','create','own','NORMAL',true,'{}','Create own requests'),
  ('timeoff_request.create.all','timeoff_request','create','all','NORMAL',true,'{}','Create requests for anyone'),
  ('timeoff_request.update.own','timeoff_request','update','own','NORMAL',true,'{}','Edit own pending requests'),
  ('timeoff_request.update.all','timeoff_request','update','all','NORMAL',true,'{}','Edit any request'),
  ('timeoff_request.delete.all','timeoff_request','delete','all','NORMAL',true,'{}','Delete requests'),
  ('timeoff_request.approve','timeoff_request','approve',NULL,'NORMAL',true,'{}','Approve or refuse requests'),
  ('timeoff_allocation.read.own','timeoff_allocation','read','own','NORMAL',true,'{}','View own allocations'),
  ('timeoff_allocation.read.all','timeoff_allocation','read','all','NORMAL',true,ARRAY['timeoff_allocation.read.own']::text[],'View all allocations'),
  ('timeoff_allocation.create.all','timeoff_allocation','create','all','NORMAL',true,'{}','Create allocations'),
  ('timeoff_allocation.update.all','timeoff_allocation','update','all','NORMAL',true,'{}','Update allocations'),
  ('timeoff_allocation.delete.all','timeoff_allocation','delete','all','NORMAL',true,'{}','Delete allocations'),
  ('timeoff_allocation.approve','timeoff_allocation','approve',NULL,'NORMAL',true,'{}','Approve allocations'),
  ('salary_structure.list_names','salary_structure','list_names',NULL,'NORMAL',true,'{}','List structure names'),
  ('salary_structure.read','salary_structure','read',NULL,'NORMAL',true,ARRAY['salary_structure.list_names']::text[],'Read structures and rules'),
  ('salary_structure.create','salary_structure','create',NULL,'NORMAL',true,'{}','Create structures'),
  ('salary_structure.update','salary_structure','update',NULL,'NORMAL',true,ARRAY['salary_structure.dry_run']::text[],'Update structures'),
  ('salary_structure.delete','salary_structure','delete',NULL,'NORMAL',true,'{}','Delete structures'),
  ('salary_structure.dry_run','salary_structure','dry_run',NULL,'NORMAL',true,'{}','Dry-run a structure'),
  ('salary_rule.read','salary_rule','read',NULL,'NORMAL',true,'{}','Read salary rules'),
  ('salary_rule.create','salary_rule','create',NULL,'NORMAL',true,'{}','Create salary rules'),
  ('salary_rule.update','salary_rule','update',NULL,'NORMAL',true,'{}','Update salary rules'),
  ('salary_rule.delete','salary_rule','delete',NULL,'NORMAL',true,'{}','Delete salary rules'),
  ('payrun.read','payrun','read',NULL,'NORMAL',true,'{}','View payruns'),
  ('payrun.create','payrun','create',NULL,'NORMAL',true,'{}','Create payruns'),
  ('payrun.update','payrun','update',NULL,'NORMAL',true,'{}','Update payruns'),
  ('payrun.delete','payrun','delete',NULL,'NORMAL',true,'{}','Cancel payruns'),
  ('payrun.compute','payrun','compute',NULL,'NORMAL',true,'{}','Compute payruns'),
  ('payrun.validate','payrun','validate',NULL,'NORMAL',true,'{}','Validate payruns'),
  ('payrun.pay','payrun','pay',NULL,'NORMAL',true,'{}','Mark payruns paid'),
  ('payrun.send','payrun','send',NULL,'NORMAL',true,'{}','Send payslips'),
  ('payrun.override_issue','payrun','override_issue',NULL,'NORMAL',true,'{}','Override overridable issues'),
  ('payrun.export','payrun','export',NULL,'NORMAL',true,'{}','Export bank file'),
  ('payslip.read.own','payslip','read','own','NORMAL',true,'{}','View own payslips'),
  ('payslip.read.all','payslip','read','all','NORMAL',true,ARRAY['payslip.read.own']::text[],'View all payslips'),
  ('payslip.update.all','payslip','update','all','NORMAL',true,'{}','Edit payslip metadata'),
  ('payslip.delete.all','payslip','delete','all','NORMAL',true,'{}','Delete payslips'),
  ('dashboard.read.hr','dashboard','read','hr','NORMAL',true,'{}','HR dashboard widgets'),
  ('dashboard.read.payroll','dashboard','read','payroll','NORMAL',true,'{}','Payroll dashboard widgets'),
  ('candidate.read','candidate','read',NULL,'NORMAL',true,'{}','View candidates'),
  ('candidate.create','candidate','create',NULL,'NORMAL',true,'{}','Create candidates'),
  ('candidate.update','candidate','update',NULL,'NORMAL',true,'{}','Update candidates'),
  ('candidate.delete','candidate','delete',NULL,'NORMAL',true,'{}','Delete candidates'),
  ('candidate.compare','candidate','compare',NULL,'NORMAL',true,ARRAY['candidate.read']::text[],'Compare candidates'),
  ('candidate.reveal','candidate','reveal',NULL,'NORMAL',true,'{}','Reveal candidate identity (audited)'),
  ('candidate.convert','candidate','convert',NULL,'NORMAL',true,'{}','Convert candidate to employee'),
  ('chat.access','chat','access',NULL,'NORMAL',true,'{}','Use the AI assistant'),
  ('chat.admin','chat','admin',NULL,'ADMIN',true,'{}','View other users chat sessions'),
  ('user.read','user','read',NULL,'ADMIN',true,'{}','View users'),
  ('user.create','user','create',NULL,'ADMIN',true,'{}','Create users'),
  ('user.update','user','update',NULL,'ADMIN',true,'{}','Update users'),
  ('user.delete','user','delete',NULL,'ADMIN',true,'{}','Delete users'),
  ('role.assign','role','assign',NULL,'ADMIN',true,'{}','Assign roles'),
  ('permission.grant','permission','grant',NULL,'ADMIN',true,'{}','Grant permissions'),
  ('audit.read','audit','read',NULL,'ADMIN',true,'{}','Read audit log'),
  ('audit.export','audit','export',NULL,'ADMIN',true,'{}','Export audit log'),
  ('ai.settings','ai','settings',NULL,'ADMIN',true,'{}','Manage AI profiles'),
  ('seed.manage','seed','manage',NULL,'ADMIN',false,'{}','Manage demo seed data');

INSERT INTO role (code, name) VALUES
  ('EMPLOYEE','Employee'),
  ('HR_MANAGER','HR Manager'),
  ('HR_PAYROLL_USER','HR Payroll User'),
  ('HR_PAYROLL_MANAGER','HR Payroll Manager'),
  ('ADMIN','Admin');

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, c FROM role r CROSS JOIN unnest(ARRAY[
  'attendance.create.own','attendance.read.own','contract.read.own','employee.read.own','payslip.read.own','timeoff_allocation.read.own','timeoff_request.create.own','timeoff_request.read.own','timeoff_request.update.own','timeoff_type.read'
]::text[]) AS c WHERE r.code = 'EMPLOYEE';

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, c FROM role r CROSS JOIN unnest(ARRAY[
  'attendance.create.all','attendance.create.own','attendance.delete.all','attendance.read.all','attendance.read.own','attendance.update.all','candidate.compare','candidate.convert','candidate.create','candidate.delete','candidate.read','candidate.reveal','candidate.update','contract.activate','contract.create.all','contract.delete.all','contract.read.all','contract.read.own','contract.update.all','dashboard.read.hr','employee.create.all','employee.delete.all','employee.read.all','employee.read.own','employee.read.sensitive','employee.update.all','payslip.read.own','salary_structure.list_names','schedule.create.all','schedule.delete.all','schedule.read.all','schedule.update.all','timeoff_allocation.approve','timeoff_allocation.create.all','timeoff_allocation.delete.all','timeoff_allocation.read.all','timeoff_allocation.read.own','timeoff_allocation.update.all','timeoff_request.approve','timeoff_request.create.all','timeoff_request.create.own','timeoff_request.delete.all','timeoff_request.read.all','timeoff_request.read.own','timeoff_request.update.all','timeoff_request.update.own','timeoff_type.manage','timeoff_type.read'
]::text[]) AS c WHERE r.code = 'HR_MANAGER';

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, c FROM role r CROSS JOIN unnest(ARRAY[
  'attendance.create.all','attendance.create.own','attendance.delete.all','attendance.read.all','attendance.read.own','attendance.update.all','candidate.compare','candidate.convert','candidate.create','candidate.delete','candidate.read','candidate.reveal','candidate.update','contract.activate','contract.create.all','contract.delete.all','contract.read.all','contract.read.own','contract.update.all','dashboard.read.hr','dashboard.read.payroll','employee.create.all','employee.delete.all','employee.read.all','employee.read.own','employee.read.sensitive','employee.update.all','payrun.compute','payrun.create','payrun.read','payrun.send','payrun.update','payrun.validate','payslip.read.all','payslip.read.own','payslip.update.all','salary_rule.read','salary_structure.list_names','salary_structure.read','schedule.create.all','schedule.delete.all','schedule.read.all','schedule.update.all','timeoff_allocation.approve','timeoff_allocation.create.all','timeoff_allocation.delete.all','timeoff_allocation.read.all','timeoff_allocation.read.own','timeoff_allocation.update.all','timeoff_request.approve','timeoff_request.create.all','timeoff_request.create.own','timeoff_request.delete.all','timeoff_request.read.all','timeoff_request.read.own','timeoff_request.update.all','timeoff_request.update.own','timeoff_type.manage','timeoff_type.read'
]::text[]) AS c WHERE r.code = 'HR_PAYROLL_USER';

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, c FROM role r CROSS JOIN unnest(ARRAY[
  'attendance.create.all','attendance.create.own','attendance.delete.all','attendance.read.all','attendance.read.own','attendance.update.all','candidate.compare','candidate.convert','candidate.create','candidate.delete','candidate.read','candidate.reveal','candidate.update','contract.activate','contract.create.all','contract.delete.all','contract.read.all','contract.read.own','contract.update.all','dashboard.read.hr','dashboard.read.payroll','employee.create.all','employee.delete.all','employee.read.all','employee.read.own','employee.read.sensitive','employee.update.all','payrun.compute','payrun.create','payrun.delete','payrun.export','payrun.override_issue','payrun.pay','payrun.read','payrun.send','payrun.update','payrun.validate','payslip.delete.all','payslip.read.all','payslip.read.own','payslip.update.all','salary_rule.create','salary_rule.delete','salary_rule.read','salary_rule.update','salary_structure.create','salary_structure.delete','salary_structure.dry_run','salary_structure.list_names','salary_structure.read','salary_structure.update','schedule.create.all','schedule.delete.all','schedule.read.all','schedule.update.all','timeoff_allocation.approve','timeoff_allocation.create.all','timeoff_allocation.delete.all','timeoff_allocation.read.all','timeoff_allocation.read.own','timeoff_allocation.update.all','timeoff_request.approve','timeoff_request.create.all','timeoff_request.create.own','timeoff_request.delete.all','timeoff_request.read.all','timeoff_request.read.own','timeoff_request.update.all','timeoff_request.update.own','timeoff_type.manage','timeoff_type.read'
]::text[]) AS c WHERE r.code = 'HR_PAYROLL_MANAGER';

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, c FROM role r CROSS JOIN unnest(ARRAY[
  'ai.settings','attendance.create.all','attendance.create.own','attendance.delete.all','attendance.read.all','attendance.read.own','attendance.update.all','audit.export','audit.read','candidate.compare','candidate.convert','candidate.create','candidate.delete','candidate.read','candidate.reveal','candidate.update','chat.access','chat.admin','contract.activate','contract.create.all','contract.delete.all','contract.read.all','contract.read.own','contract.update.all','dashboard.read.hr','dashboard.read.payroll','employee.create.all','employee.delete.all','employee.read.all','employee.read.own','employee.read.sensitive','employee.update.all','payrun.compute','payrun.create','payrun.delete','payrun.export','payrun.override_issue','payrun.pay','payrun.read','payrun.send','payrun.update','payrun.validate','payslip.delete.all','payslip.read.all','payslip.read.own','payslip.update.all','permission.grant','role.assign','salary_rule.create','salary_rule.delete','salary_rule.read','salary_rule.update','salary_structure.create','salary_structure.delete','salary_structure.dry_run','salary_structure.list_names','salary_structure.read','salary_structure.update','schedule.create.all','schedule.delete.all','schedule.read.all','schedule.update.all','seed.manage','timeoff_allocation.approve','timeoff_allocation.create.all','timeoff_allocation.delete.all','timeoff_allocation.read.all','timeoff_allocation.read.own','timeoff_allocation.update.all','timeoff_request.approve','timeoff_request.create.all','timeoff_request.create.own','timeoff_request.delete.all','timeoff_request.read.all','timeoff_request.read.own','timeoff_request.update.all','timeoff_request.update.own','timeoff_type.manage','timeoff_type.read','user.create','user.delete','user.read','user.update'
]::text[]) AS c WHERE r.code = 'ADMIN';
