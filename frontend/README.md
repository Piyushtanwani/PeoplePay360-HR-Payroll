# PeoplePay360 — Frontend

React 18 + TypeScript client for the PeoplePay360 HR and Payroll platform. This build runs
entirely against an in-browser mock of the Part B REST contract, so **no backend is required**.

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
| `npm run dev` | Vite dev server with the MSW mock layer enabled |
| `npm run build` | Type-check and produce a production bundle in `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |

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

## Switching to the real backend

1. Start the Spring Boot API on `http://localhost:8080`.
2. Set `VITE_USE_MOCKS=false` in `.env`.
3. Restart the dev server — Vite proxies `/api` and `/.well-known` to the backend.

Nothing else changes: every screen already calls the Part B endpoints with the Part B field names,
so deleting `src/mocks/` is the only cleanup needed once the API is live.

## Architecture

```
src/
  api/          types.ts (contract DTOs), client.ts (fetch wrapper, Problem+JSON → ApiError), hooks.ts
  auth/         AuthProvider (token, /auth/me, can()), permissions.ts (B5 matrix + implies)
  app/          router.tsx, theme.ts, shell/ (sidebar, top bar, ⌘K palette, notifications)
  components/ui/ design-system primitives — Button, Card, Select, DataTable, Sheet, Toast, KpiCard …
  design/       tokens.css — light and dark palettes as CSS variables
  features/     one folder per module (dashboard, employees, contracts, schedules, attendance,
                timeoff, payroll, admin, settings)
  mocks/        MSW handlers + a deterministic 40-employee dataset mirroring B6
```

### Design system

Apple-inspired token layer in `src/design/tokens.css`: surface/label/separator variables,
10 px control radius, 14 px cards, 20 px sheets, tabular numerals on every figure. Dark mode
follows `prefers-color-scheme` and can be overridden from **Settings**; the choice persists in
`localStorage`.

### Permission model

`src/auth/permissions.ts` encodes the complete B5 catalogue, the role → permission seed and the
`implies` expansion. The frontend never decides permissions on its own — it reads the effective set
from `GET /api/auth/me` and hides or disables accordingly. Navigation groups render only when the
user holds at least one permission inside them.

### Mock layer

`src/mocks/data/seed.ts` builds a deterministic dataset at startup: 40 employees across four
departments, five working schedules, three salary structures with sequenced rules, 90 days of
attendance with late/absent/overtime/missing-checkout patterns, time-off types with allocations and
balances, and six payruns (April–September 2026) covering every lifecycle state. Handlers under
`src/mocks/handlers/` enforce the same status codes as the backend, including `CONTRACT_OVERLAP`,
`BLOCKERS_PRESENT`, `NOT_OVERRIDABLE` and `SELF_ACTION`.

## Screens

Dashboard · Employees (Kanban + List + detail with smart buttons) · Contracts · Working Schedules ·
Attendance (quick check-in widget, records, exceptions) · Time Off (requests, allocations, types,
holidays) · Payruns (two-step wizard, lifecycle, issues, delivery) · Payslips (computation,
variance, PDF) · Salary Structures (sequenced rules, dry run) · Users & Access · AI Settings ·
Audit Log · Health · Settings.

## Known gaps

- The Assistant and Recruitment modules from the original prompt are not built in this pass.
- No automated test suite yet; the build is verified with `tsc --noEmit` and a production `vite build`.
- The main bundle is ~956 kB (278 kB gzipped); route-level code splitting is the next optimisation.
