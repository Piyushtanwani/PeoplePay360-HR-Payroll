# PeoplePay360 FastMCP Intelligence Service

The **Model Context Protocol (MCP)** service is a Python 3.12+ FastAPI application that empowers the PeoplePay360 AI Assistant to read live HR & Payroll data safely, reason over employee records, and format interactive UI components.

---

## 🏗️ Architecture & Request Flow

```
[User Webchat (React)]
         │
         ▼ (HTTP POST /api/chat/sessions/{id}/messages)
[Spring Boot Backend (Port 8080)]
   │ • Mints Delegated JWT (aud=mcp, act=chat, 5-min TTL)
   │ • Validates Rate Limits & User Ownership
   ▼ (HTTP POST /chat with X-Gateway-Secret + Bearer Delegated Token)
[Python FastMCP Service (Port 8000)]
   │ 1. Validates X-Gateway-Secret (constant-time HMAC)
   │ 2. Validates Bearer Token & checks fine-grained permissions
   │ 3. Filters tool definitions so LLM only sees permitted actions
   │ 4. Invokes LLM (Ollama / OpenRouter / NVIDIA NIM / Mock)
   │ 5. Executes requested tools:
   │      │
   │      ▼ (HTTP GET only with Caller's Delegated JWT)
   │   [Spring Boot REST Endpoints] ──► [PostgreSQL 16]
   │      │
   │ 6. Sanitizes PII for model token context (removes email, phone, bank info)
   │ 7. Assembles UI Blocks (KPI cards, Tables, Links, Refusals, Proposed Actions)
   │ 8. Enforces Number Grounding against hallucinations
   ▼
[JSON Response: Assistant Markdown + UI Blocks + Audit Records]
```

---

## 📁 Directory Structure

```text
mcp/
├── .env.example              # Environment variables template
├── .env                      # Local runtime configuration
├── pyproject.toml            # Poetry / setuptools configuration
├── requirements.txt          # Pip dependencies
├── README.md                 # Architecture and usage documentation
├── app/
│   ├── __init__.py
│   ├── settings.py           # Pydantic v2 settings & environment binding
│   ├── security.py           # HMAC secret verification & Bearer token decoding
│   ├── backend.py            # Read-only AsyncClient for Spring Boot API
│   ├── views.py              # PII stripping (model_view) vs rich UI display (ui_view)
│   ├── blocks.py             # Rich UI blocks: kpi, table, list, link, refusal, action
│   ├── registry.py           # Deny-by-default tool registry & permissions gate
│   ├── schemas.py            # Pydantic request/response and tool models
│   ├── providers.py          # Connectors for Ollama (11434), OpenRouter, NVIDIA, Mock
│   ├── chat.py               # Conversational tool execution loop
│   ├── mcp_server.py         # Standard FastMCP server instance
│   ├── main.py               # FastAPI application entrypoint
│   └── tools/                # 13+ FastMCP tools
│       ├── __init__.py       # Auto-registers all tools
│       ├── whoami.py
│       ├── employee_search.py
│       ├── employee_summary.py
│       ├── timeoff_get_balance.py
│       ├── timeoff_list_pending.py
│       ├── attendance_list_exceptions.py
│       ├── payrun_list.py
│       ├── payrun_list_issues.py
│       ├── payslip_list.py
│       ├── payslip_explain.py
│       ├── dashboard_kpis.py
│       ├── contract_list_expiring.py
│       └── candidate_compare.py
└── tests/
    ├── __init__.py
    ├── conftest.py           # Test fixtures and mock tokens
    ├── test_security.py      # Gateway secret & token tests
    ├── test_views.py         # PII sanitization tests
    ├── test_tools.py         # 13 tools registration & RBAC tests
    └── test_chat.py          # Chat turn orchestration tests
```

---

## 🛠️ The 13 FastMCP Tools

| Tool Name | Required Permission | Backend Endpoint Called | Description & Produced Blocks |
|---|---|---|---|
| `whoami` | `authenticated` | `GET /api/auth/me` | Current user identity, active role, permissions. Generates KPI & List blocks. |
| `employee_search` | `employee.read` | `GET /api/employees` | Search employees by name, department, status. Strips PII. Generates Table block. |
| `employee_summary` | `employee.read` | `GET /api/employees/{id}/summary` | 360 overview of employee: contracts, attendance, leave counts, job info. Generates KPI & Link blocks. |
| `timeoff_get_balance` | `timeoff.read` | `GET /api/timeoff/balances` | Accrued, taken, pending, and remaining days for leave types. Generates KPI & Table blocks. |
| `timeoff_list_pending` | `timeoff.read` | `GET /api/timeoff/requests` | Pending leave requests awaiting manager approval. Generates Table block. |
| `attendance_list_exceptions`| `attendance.read` | `GET /api/attendance/exceptions` | Missing check-outs, late arrivals, early departures for period. Generates KPI & Table blocks. |
| `payrun_list` | `payroll.read` | `GET /api/payruns` | Payrun batches with state (DRAFT, COMPUTED, VALIDATED, PAID). Generates Table & Action blocks. |
| `payrun_list_issues` | `payroll.read` | `GET /api/payruns/{id}/issues` | Pre-validation warning checks (missing bank, overlapping contracts). Generates KPI & Table blocks. |
| `payslip_list` | `payslip.read` | `GET /api/payslips` | Payslips with gross pay, deductions, and net salary. Generates Table block. |
| `payslip_explain` | `payslip.read` | `GET /api/payslips/{id}` | Detailed salary rule formula computation lines and download link. Generates KPI & Table blocks. |
| `dashboard_kpis` | `payroll.read` | `GET /api/reports/dashboard` | High-level analytics: total net paid, headcount, avg salary, attendance health. Generates multiple KPI blocks. |
| `contract_list_expiring` | `contract.read` | `GET /api/contracts` | Employment contracts expiring within a given time window (e.g. 60 days). Generates Table block. |
| `candidate_compare` | `candidate.compare` | `GET /api/recruitment/openings/{id}/comparison` | Compares 2-5 job applicants against rubric score and salary fit. Generates KPI & Table blocks. |

---

## 🔒 Security Guarantees

1. **Deny by Default:**
   Tools are executed only if the caller's delegated JWT contains the required authority or `ROLE_ADMIN`. If unauthorized, a clean refusal block is returned immediately without contacting the backend.
2. **Read-Only by Construction:**
   The `BackendClient` only implements HTTP `get()`. There are no write, update, or delete methods in the service.
3. **Dual View (PII Stripping):**
   Sensitive information (`workEmail`, `phone`, `bankAccountNumber`, `panNumber`) is stripped from `model_view` before being passed into the LLM context, preventing training leakage and unauthorized data exposure.
4. **Gateway Secret Verification:**
   All calls between Spring Boot and MCP must provide a constant-time validated `X-Gateway-Secret` header.

---

## 🚀 Running the Service

### 1. Setup Python Environment
```bash
cd mcp
python -m venv .venv

# On Windows:
.venv\Scripts\activate

# On Linux/macOS:
source .venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run Development Server
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The service will be available at `http://localhost:8000`.
- Health Check: `http://localhost:8000/health`
- Swagger Documentation: `http://localhost:8000/docs`

### 4. Running Unit Tests
```bash
pytest
```
