import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { RequireAuth, RequirePermission } from './routes/guards'
import { RouteError } from './routes/RouteError'
import { LoginPage } from '@/features/auth/LoginPage'
import { HomeRoute } from '@/features/dashboard/HomeRoute'
import { EmployeesPage } from '@/features/employees/EmployeesPage'
import { EmployeeDetailPage } from '@/features/employees/EmployeeDetailPage'
import { ContractsPage } from '@/features/contracts/ContractsPage'
import { SchedulesPage } from '@/features/schedules/SchedulesPage'
import { AttendancePage } from '@/features/attendance/AttendancePage'
import { TimeOffPage } from '@/features/timeoff/TimeOffPage'
import { PayrunsPage } from '@/features/payroll/PayrunsPage'
import { PayrunWizardPage } from '@/features/payroll/PayrunWizardPage'
import { PayrunDetailPage } from '@/features/payroll/PayrunDetailPage'
import { PayslipsPage } from '@/features/payroll/PayslipsPage'
import { SalaryStructuresPage } from '@/features/payroll/SalaryStructuresPage'
import { UsersPage } from '@/features/admin/UsersPage'
import { AiSettingsPage } from '@/features/admin/AiSettingsPage'
import { AuditPage } from '@/features/admin/AuditPage'
import { HealthPage } from '@/features/admin/HealthPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

const gate = (permission: string | string[], element: JSX.Element) => (
  <RequirePermission permission={permission}>{element}</RequirePermission>
)

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'employees', element: gate('employee.read.all', <EmployeesPage />) },
      { path: 'employees/:id', element: gate(['employee.read.own', 'employee.read.all'], <EmployeeDetailPage />) },
      { path: 'contracts', element: gate(['contract.read.own', 'contract.read.all'], <ContractsPage />) },
      { path: 'schedules', element: gate('schedule.read.all', <SchedulesPage />) },
      { path: 'attendance', element: gate(['attendance.read.own', 'attendance.read.all'], <AttendancePage />) },
      { path: 'timeoff', element: gate(['timeoff_request.read.own', 'timeoff_request.read.all'], <TimeOffPage />) },
      { path: 'payroll/payruns', element: gate('payrun.read', <PayrunsPage />) },
      { path: 'payroll/payruns/new', element: gate('payrun.create', <PayrunWizardPage />) },
      { path: 'payroll/payruns/:id', element: gate('payrun.read', <PayrunDetailPage />) },
      { path: 'payroll/payslips', element: gate(['payslip.read.own', 'payslip.read.all'], <PayslipsPage />) },
      { path: 'payroll/salary-structures', element: gate('salary_structure.read', <SalaryStructuresPage />) },
      { path: 'admin/users', element: gate('user.read', <UsersPage />) },
      { path: 'admin/ai', element: gate('ai.settings', <AiSettingsPage />) },
      { path: 'admin/audit', element: gate('audit.read', <AuditPage />) },
      { path: 'admin/health', element: gate('user.read', <HealthPage />) },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
