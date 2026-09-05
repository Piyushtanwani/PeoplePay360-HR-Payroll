# PeoplePay360 — Frontend

React 18 + TypeScript client for the PeoplePay360 HR and Payroll platform. It talks to the Spring
Boot API on `http://localhost:8080`; start that first. The mock layer is now a test fixture only and
no longer runs in the browser.

## Running it

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

`npm install` must be run on your own machine — `node_modules` is not committed and native
build tools (esbuild, rollup) are platform specific.

Other scripts:

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server against the API on port 8080 |
| `npm run build` | Type-check and produce a production bundle in `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest suite (97 tests) |
| `npm run lint` | ESLint, zero warnings tolerated |
| `npm run knip` | Fails on any unused file, export or dependency |
| `npm run verify` | Every gate above, in order |

## Demo accounts

Pick one from the **Try as** dropdown on the login screen, or type the credentials.

| Email | Password | Role | Sees |
|---|---|---|---|
| `admin@peoplepay.local` | `Admin@12345` | Administrator | Everything, including Users, Audit and AI settings |
| `payroll.manager@peoplepay.local` | `Manager@12345` | HR Payroll Manager | Can pay, override issues, edit salary structures |
| `payroll@peoplepay.local` | `Payroll@12345` | HR Payroll User | Computes and validates payruns; cannot mark paid |
| `hr@peoplepay.local` | `Hr@12345` | HR Manager | People and Time modules; no payroll figures |
| `employee@peoplepay.local` | `Employee@12345` | Employee | Self-service attendance, time off and payslips only |

Signing in as different accounts is the fastest way to see role-aware rendering: the HR Manager
dashboard reflows without payroll widgets, the Employee lands on a self-service attendance screen,
and Payroll User sees a disabled **Mark paid** action.

## Pointing at a backend

`VITE_API_BASE_URL` in `.env` decides where requests go, and defaults to `http://localhost:8080`.
Leave it empty to route through the Vite proxy instead, which forwards `/api` and `/.well-known` to
the same port. The backend allows both `localhost:5173` and `localhost:3000` as origins.

## Architecture

```
src/
  api/          types.ts (contract DTOs), client.ts (fetch wrapper, Problem+JSON → ApiError), hooks.ts
  auth/         AuthProvider (token, /auth/me, can()), permissions.ts (B5 matrix + implies)
  app/          router.tsx, theme.ts, shell/ (sidebar, top bar, ⌘K palette, notifications)
  components/ui/ design-system primitives — Button, Card, Select, DataTable, Sheet, Toast, KpiCard …
  design/       tokens.css — light and dark palettes as CSS variables
  features/     one folder per module (dashboard, employees, contracts, schedules, attendance,
                timeoff, payroll, admin, profile, chat)
  lib/          dates, money and number formatting, table state, download helper
  test/         Vitest setup, render helpers, and the MSW fixtures used by integration tests
```

### Design system

Apple-inspired token layer in `src/design/tokens.css`: surface/label/separator variables,
10 px control radius, 14 px cards, 20 px sheets, tabular numerals on every figure. Dark mode
follows `prefers-color-scheme` and can be overridden from **Profile**; the choice persists in
`localStorage`.

Every list in the application is the same `DataTable`: one toolbar, one search box, one footer that
reads "Showing 21–40 of 143", and a required empty state that says what would be there and what to
do about it. Paging, sorting and search are server-side and live in the address bar, so a filtered
view is a shareable link.

### Permission model

`src/auth/permissions.ts` encodes the complete B5 catalogue, the role → permission seed and the
`implies` expansion. The frontend never decides permissions on its own — it reads the effective set
from `GET /api/auth/me` and hides or disables accordingly. Navigation groups render only when the
user holds at least one permission inside them.

### Tests

`npm run test` runs 97 Vitest specs across 11 files. Most render a component with its data layer
stubbed; `EmployeesPage.integration.test.tsx` instead runs the real hooks and the real client against
the MSW fixtures in `src/test/msw/`, which reproduce the backend's page envelope, sorting and
permission checks. That is what proves paging and role gating are wired rather than merely drawn.

The fixture dataset is deterministic: 40 employees across four departments, five working schedules,
three salary structures with sequenced rules, 90 days of attendance covering late, absent, overtime
and missing-checkout, time-off types with allocations and balances, and six payruns spanning every
lifecycle state. The handlers return the same status codes as the backend, including
`CONTRACT_OVERLAP`, `BLOCKERS_PRESENT`, `NOT_OVERRIDABLE` and `SELF_ACTION`.

## Screens

Dashboard, one per role · Employees (Kanban + List + detail) · Departments · Contracts (with
reusable templates) · Working Schedules · Attendance (check-in widget, records, exceptions, and a
help panel explaining the classification rules) · Time Off (requests, allocations, types, holidays) ·
Payruns (two-step wizard, lifecycle, issues, delivery, CSV export) · Payslips · Salary Structures
(sequenced rules, dry run with a negative-net guard) · Salary Rules · Assistant · Users & Access ·
AI Settings · Audit Log · Health · Profile.

## Known gaps

- Recruitment exists in the backend but has no screen in this pass.
- The assistant answers from live records through the MCP service. Without that service running it
  falls back to the model alone and says so in the composer.
