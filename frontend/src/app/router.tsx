import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { RequireAuth, RequirePermission } from './routes/guards'
import { RouteError } from './routes/RouteError'
import { LoginPage } from '@/features/auth/LoginPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { SetPasswordPage } from '@/features/auth/SetPasswordPage'
import { HomeRoute } from '@/features/dashboard/HomeRoute'

const gate = (permission: string | string[], element: JSX.Element) => (
  <RequirePermission permission={permission}>{element}</RequirePermission>
)

/**
 * A route that fetches its own page on first visit.
 *
 * Everything used to arrive in one bundle, so signing in downloaded the payrun wizard, the audit log
 * and the assistant whether or not the person could open any of them. Each page is now its own chunk,
 * fetched when it is first needed, and the permission gate still runs before anything renders.
 */
function page(load: () => Promise<() => JSX.Element>, permission?: string | string[]) {
  return async () => {
    const Component = await load()
    const element = <Component />
    return { element: permission ? gate(permission, element) : element }
  }
}

export const router = createBrowserRouter([
  // The sign-in screens stay in the first bundle: they are the first thing anyone sees.
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  { path: '/forgot-password', element: <ForgotPasswordPage />, errorElement: <RouteError /> },
  { path: '/set-password', element: <SetPasswordPage />, errorElement: <RouteError /> },
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
      {
        path: 'employees',
        lazy: page(() => import('@/features/employees/EmployeesPage').then((m) => m.EmployeesPage), 'employee.read.all'),
      },
      {
        path: 'employees/:id',
        lazy: page(() => import('@/features/employees/EmployeeDetailPage').then((m) => m.EmployeeDetailPage),
          ['employee.read.own', 'employee.read.all']),
      },
      {
        path: 'departments',
        lazy: page(() => import('@/features/employees/DepartmentsPage').then((m) => m.DepartmentsPage), 'employee.read.all'),
      },
      {
        path: 'contracts',
        lazy: page(() => import('@/features/contracts/ContractsPage').then((m) => m.ContractsPage),
          ['contract.read.own', 'contract.read.all']),
      },
      {
        path: 'schedules',
        lazy: page(() => import('@/features/schedules/SchedulesPage').then((m) => m.SchedulesPage), 'schedule.read.all'),
      },
      {
        path: 'attendance',
        lazy: page(() => import('@/features/attendance/AttendancePage').then((m) => m.AttendancePage),
          ['attendance.read.own', 'attendance.read.all']),
      },
      {
        path: 'timeoff',
        lazy: page(() => import('@/features/timeoff/TimeOffPage').then((m) => m.TimeOffPage),
          ['timeoff_request.read.own', 'timeoff_request.read.all']),
      },
      {
        path: 'payroll/payruns',
        lazy: page(() => import('@/features/payroll/PayrunsPage').then((m) => m.PayrunsPage), 'payrun.read'),
      },
      {
        path: 'payroll/payruns/new',
        lazy: page(() => import('@/features/payroll/PayrunWizardPage').then((m) => m.PayrunWizardPage), 'payrun.create'),
      },
      {
        path: 'payroll/payruns/:id',
        lazy: page(() => import('@/features/payroll/PayrunDetailPage').then((m) => m.PayrunDetailPage), 'payrun.read'),
      },
      {
        path: 'payroll/payslips',
        lazy: page(() => import('@/features/payroll/PayslipsPage').then((m) => m.PayslipsPage),
          ['payslip.read.own', 'payslip.read.all']),
      },
      {
        path: 'payroll/salary-structures',
        lazy: page(() => import('@/features/payroll/SalaryStructuresPage').then((m) => m.SalaryStructuresPage),
          'salary_structure.read'),
      },
      {
        path: 'payroll/salary-rules',
        lazy: page(() => import('@/features/payroll/SalaryRulesPage').then((m) => m.SalaryRulesPage), 'salary_rule.read'),
      },
      {
        path: 'assistant',
        lazy: page(() => import('@/features/chat/AssistantPage').then((m) => m.AssistantPage), 'chat.access'),
      },
      {
        path: 'admin/users',
        lazy: page(() => import('@/features/admin/UsersPage').then((m) => m.UsersPage), 'user.read'),
      },
      {
        path: 'admin/ai',
        lazy: page(() => import('@/features/admin/AiSettingsPage').then((m) => m.AiSettingsPage), 'ai.settings'),
      },
      {
        path: 'admin/audit',
        lazy: page(() => import('@/features/admin/AuditPage').then((m) => m.AuditPage), 'audit.read'),
      },
      {
        path: 'admin/health',
        lazy: page(() => import('@/features/admin/HealthPage').then((m) => m.HealthPage), 'user.read'),
      },
      // No permission gate: everyone has a profile, and it only ever shows their own.
      { path: 'profile', lazy: page(() => import('@/features/profile/ProfilePage').then((m) => m.ProfilePage)) },
      { path: 'settings', element: <Navigate to="/profile" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
