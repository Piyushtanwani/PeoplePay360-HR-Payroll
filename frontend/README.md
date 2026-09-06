# PeoplePay360 Frontend: React 18 + TypeScript Client

A role-aware Single Page Application (SPA) built with **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Radix UI** for the PeoplePay360 HR & Payroll platform.

The client communicates with the Spring Boot backend on `http://localhost:8080` and renders domain modules tailored to the authenticated user's permissions. It features an interactive **AI Assistant** interface with in-place prompt editing, typewriter animations, and rich UI blocks (KPIs, tables, deep links, and action buttons).

---

## 🛠️ Technology Stack

* **Framework**: React 18 + Vite
* **Language**: TypeScript 5.x (Strict mode)
* **Styling**: Tailwind CSS + Custom Design System Tokens (`tokens.css`)
* **Component Primitives**: Radix UI (Dialog, DropdownMenu, Tooltip, Popover, Tabs)
* **State & Data Fetching**: TanStack React Query v5 (caching, optimistic updates, cache invalidation)
* **Icons**: Lucide React
* **Charts & Analytics**: Recharts
* **Testing**: Vitest + React Testing Library + Mock Service Worker (MSW)

---

## 🚀 Quick Start

### 1. Prerequisites
* **Node.js 18+** (Node.js 20+ recommended)
* **npm 9+**
* Running Spring Boot backend (`http://localhost:8080`)

### 2. Installation & Run

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Vite automatically proxies `/api` requests to `http://localhost:8080`.

---

## 📜 Available NPM Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `vite` | Starts development server on port 5173 with HMR |
| `npm run build` | `tsc && vite build` | Validates types and compiles production bundle into `dist/` |
| `npm run preview` | `vite preview` | Previews production build locally |
| `npm run typecheck` | `tsc --noEmit` | Strict TypeScript compiler check without emitting output |
| `npm run test` | `vitest run` | Runs unit and integration test suite (MSW fixtures) |
| `npm run lint` | `eslint .` | Runs ESLint rules (zero warnings tolerated) |
| `npm run knip` | `knip` | Detects unused files, dependencies, and exports |
| `npm run verify` | Combined pipeline | Runs lint, knip, typecheck, and test in sequence |

---

## 👥 Demo Logins & Role-Aware Views

Use the **Try as** quick-switcher on the login page or enter credentials:

| Email | Password | Role | Specialized Client Views |
|---|---|---|---|
| `admin@peoplepay.local` | `Admin@12345` | **Administrator** | Full access: Users & Access, AI Provider Settings, Audit Log |
| `payroll.manager@peoplepay.local` | `Manager@12345` | **HR Payroll Manager** | Full payroll control: edit salary structures, validate, override issues, mark paid |
| `payroll@peoplepay.local` | `Payroll@12345` | **HR Payroll User** | Computes payruns, reviews pre-flight checks; **Mark Paid** action is disabled |
| `hr@peoplepay.local` | `Hr@12345` | **HR Manager** | People, contracts, attendance, time-off; payroll widgets are redacted |
| `employee@peoplepay.local` | `Employee@12345` | **Employee** | Self-service dashboard: punch clock, leave requests, own payslip breakdown & AI chat |

---

## 📁 Architecture & Feature Structure

```text
frontend/src/
├── api/
│   ├── client.ts             # Fetch wrapper with JWT injection & RFC 7807 error parsing
│   ├── hooks.ts              # TanStack Query custom hooks for all REST endpoints
│   ├── types.ts              # Strongly-typed API contracts (DTOs)
│   └── constants.ts          # Badges, tones, and select options
│
├── app/
│   ├── router.tsx            # Route definitions with lazy loading & RBAC guards
│   ├── theme.ts              # Theme persistence and system preference sync
│   └── shell/                # App shell: responsive sidebar, top navigation, quick actions
│
├── auth/
│   ├── AuthProvider.tsx      # Auth state, login/logout, effective permission evaluation (`can()`)
│   └── permissions.ts        # 83-permission catalogue, role implications & hierarchy
│
├── components/ui/            # Design-system primitives:
│   │                         # DataTable, Card, Button, Input, Select, Modal, Sheet,
│   │                         # KpiCard, Chip, ActiveBadge, Tooltip, PageHeader
│
├── design/
│   └── tokens.css            # Apple-inspired CSS variables (colors, radii, elevations)
│
├── features/                 # Modular feature domains:
│   ├── admin/                # Users, invites, AI provider settings, audit trail
│   ├── attendance/           # Daily punch in/out, worked hours, exceptions radar
│   ├── chat/                 # AI Assistant page, in-place prompt edit, UI blocks & markdown
│   ├── contracts/            # Employment contracts, wage details, working schedules
│   ├── dashboard/            # Executive KPI charts, role-filtered metrics
│   ├── employees/            # Employee master records (Kanban, table, profile detail)
│   ├── payroll/              # Payruns wizard, payslips, salary structures & rules
│   ├── profile/              # User account details and preferences
│   └── timeoff/              # Leave requests, allocations, leave types, public holidays
│
└── lib/                      # Date/currency formatters, search params, table state utilities
```

---

## 🤖 Feature Spotlight: Conversational AI Assistant (`features/chat/`)

The **AI Assistant** (`/assistant`) allows employees and managers to interrogate their records conversationally:

1. **Role-Aware Query Starters**:
   - Displays curated prompts tailored to the active user's permissions (`MANAGER_QUERIES`, `PAYROLL_MANAGER_QUERIES`, `EMPLOYEE_QUERIES`).
   - Tapping any starter card initiates the query and smoothly transitions into the active conversation session without page refreshes.
2. **In-Place Prompt Editing**:
   - Hovering over a previous prompt reveals an **Edit** button (`Pencil`).
   - Editing and saving updates the prompt directly inside its existing bubble and re-executes the turn in place, truncating any obsolete subsequent turns.
3. **Interactive UI Blocks (`Blocks.tsx`)**:
   - The assistant doesn't just return plain text—it emits structured UI components parsed from tool responses:
     - **KPI Cards**: Headcount, total net paid, average wage, attendance rate.
     - **Data Tables**: Expiring contracts, leave requests, attendance exceptions.
     - **Direct Deep Links**: One-click navigation to employee profiles, payruns, or payslips.
     - **Action Recommendations**: Guided next steps (e.g. resolve payrun blocker).
4. **Natural Typewriter Animation**:
   - Frame-timed typewriter animation smoothly reveals generated answers.

---

## 🎨 Feature Spotlight: Salary Structures & Rules (`features/payroll/`)

1. **Salary Structures (`/payroll/salary-structures`)**:
   - Full-width, single-column overview displaying structures, rule counts, assigned employee counts, and status.
   - Clicking any structure row reveals an expandable bottom detail panel with tabs for **Rules** and **Assigned People**, with interactive formula inspection.
2. **Salary Rules (`/payroll/salary-rules`)**:
   - Cross-structure catalog listing every rule in the exact sequence it executes during payroll calculation.
   - Detailed computation chips (`Fixed Amount`, `Percentage of Base Rule`, or `Arithmetic Formula`).

---

## 🧪 Testing & Validation

```bash
# Run unit tests and MSW integration suites
npm run test

# Validate full TypeScript compilation
npm run typecheck

# Check code style and formatting
npm run lint

# Audit unused exports and files
npm run knip
```

The MSW integration tests in `src/test/msw/` reproduce the backend's page envelopes, sorting, and permission checks, verifying that role gating and table states behave as expected without requiring a live backend.
