# PeoplePay360 FastMCP Intelligence Service

The **Model Context Protocol (MCP)** service is a Python 3.12+ FastAPI application that empowers the PeoplePay360 AI Assistant to safely query live HR & Payroll records, reason over organizational data, and format interactive UI components.

It functions as an isolated, secure intelligence gateway between the Spring Boot backend (`http://localhost:8080`) and the AI Provider (Ollama, OpenRouter, or NVIDIA NIM).

---

## 🏗️ Architecture & Request Flow

```
[User Webchat (React SPA)]
         │
         ▼ (HTTP POST /api/chat/sessions/{id}/messages)
[Spring Boot Backend (Port 8080)]
   │ • Verifies user identity and chat.access authority
   │ • Mints Delegated JWT (aud=mcp, act=chat, scp=["read"], 5-min TTL)
   │ • Attaches caller's effective permission codes
   ▼ (HTTP POST /chat with X-Gateway-Secret + Bearer Delegated Token)
[Python FastMCP Service (Port 8000)]
   │ 1. Validates X-Gateway-Secret (constant-time HMAC comparison)
   │ 2. Decodes Bearer Token & evaluates tool-level permission gates
   │ 3. Filters tool catalogue: LLM only sees permitted tools
   │ 4. Invokes LLM (Ollama / OpenRouter / NVIDIA NIM)
   │ 5. Executes requested tools:
   │      │
   │      ▼ (HTTP GET only with Caller's Scoped JWT)
   │   [Spring Boot REST Endpoints] ──► [PostgreSQL 16]
   │      │
   │ 6. Dual-View PII Sanitization:
   │      • model_view: strips email, phone, bank account, and PAN
   │      • ui_view: preserves safe fields for user UI rendering
   │ 7. Rich UI Block Assembly (KPI cards, Tables, Links, Refusal Badges, Action items)
   │ 8. Enforces Number Grounding against hallucinations
   ▼
[JSON Response: Assistant Markdown + UI Blocks + Trace Evidence]
```

---

## 📁 Directory Structure

```text
mcp/
├── .env.example              # Environment variables template
├── .env                      # Local runtime configuration (git-ignored)
├── pyproject.toml            # Build tool and package metadata
├── requirements.txt          # Production and test dependencies
├── README.md                 # Architecture, tools, and query documentation
├── app/
│   ├── __init__.py
│   ├── settings.py           # Pydantic v2 settings & environment binding
│   ├── security.py           # HMAC secret verification & Bearer token decoding
│   ├── backend.py            # Read-only AsyncClient for Spring Boot API (HTTP GET only)
│   ├── views.py              # PII stripping (model_view) vs UI display (ui_view)
│   ├── blocks.py             # Rich UI blocks: kpi, table, list, link, refusal, action
│   ├── registry.py           # Deny-by-default tool registry & permission evaluator
│   ├── schemas.py            # Pydantic request/response and tool models
│   ├── providers.py          # Connectors for Ollama (11434), OpenRouter, NVIDIA NIM, Mock
│   ├── chat.py               # Conversational tool execution loop & turn orchestration
│   ├── mcp_server.py         # FastMCP server instance and tool decorators
│   ├── main.py               # FastAPI application entrypoint (port 8000)
│   └── tools/                # 15 FastMCP read-only tool implementations
│       ├── __init__.py       # Auto-registers all 15 tools into central registry
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
│       ├── contract_get_current.py
│       ├── candidate_compare.py
│       └── system_tools_list.py
└── tests/
    ├── __init__.py
    ├── conftest.py           # Test fixtures and mock tokens
    ├── test_security.py      # Gateway secret & token verification tests
    ├── test_views.py         # PII sanitization tests
    ├── test_tools.py         # 15 tools registration & RBAC tests
    └── test_chat.py          # Chat turn orchestration tests
```

---

## 🛠️ The 15 FastMCP Tools Reference

The permission column holds codes from the real PeoplePay360 catalogue, which the backend seeds and expands through `implies`.
- A caller holding `employee.read.all` satisfies `employee.read.own`.
- A tool scoped to `.own` is available to everyone and returns only what that person may see.
- A tool scoped to `.all` is refused outright if the caller lacks the required scope.

| # | Tool Name | Required Permission | Backend Endpoint Called | Description & Produced UI Blocks |
|---|---|---|---|---|
| 1 | `whoami` | `authenticated` | `GET /api/auth/me` | Current caller identity, active role, and permission set. Generates **KPI** & **List** blocks. |
| 2 | `employee_search` | `employee.read.all` | `GET /api/employees` | Search employees by name, department, status. Strips PII. Generates **Table** block. |
| 3 | `employee_summary` | `employee.read.own` | `GET /api/employees/{id}/summary` | 360° overview: job title, manager, active contract, attendance, and leave balance. Generates **KPI** & **Link** blocks. |
| 4 | `timeoff_get_balance` | `timeoff_allocation.read.own` | `GET /api/timeoff/balances` | Accrued, taken, pending, and remaining days by leave type. Generates **KPI** & **Table** blocks. |
| 5 | `timeoff_list_pending` | `timeoff_request.read.all` | `GET /api/timeoff/requests` | Pending leave requests awaiting managerial review. Generates **Table** block. |
| 6 | `attendance_list_exceptions`| `attendance.read.all` | `GET /api/attendance/exceptions` | Missing check-outs, late arrivals, absences, and overtime. Generates **KPI** & **Table** blocks. |
| 7 | `payrun_list` | `payrun.read` | `GET /api/payruns` | Payrun batches with state (Draft, Computed, Validated, Paid). Generates **Table** & **Action** blocks. |
| 8 | `payrun_list_issues` | `payrun.read` | `GET /api/payruns/{id}/issues` | Pre-validation warning checks (missing bank, overlapping contracts). Generates **KPI** & **Table** blocks. |
| 9 | `payslip_list` | `payslip.read.own` | `GET /api/payslips` | Payslips with gross pay, deductions, and net salary. Generates **Table** block. |
| 10 | `payslip_explain` | `payslip.read.own` | `GET /api/payslips/{id}` | Detailed salary rule formula computation lines and PDF download link. Generates **KPI** & **Table** blocks. |
| 11 | `dashboard_kpis` | `dashboard.read.hr` | `GET /api/reports/dashboard` | Executive analytics: total net disbursed, active headcount, avg salary, attendance health. Generates multiple **KPI** blocks. |
| 12 | `contract_list_expiring` | `contract.read.all` | `GET /api/contracts` | Employment contracts expiring within a given window (e.g. 30, 60, 90 days). Generates **Table** block. |
| 13 | `contract_get_current` | `contract.read.own` | `GET /api/contracts/active` | Current contract terms, scheduled weekly hours, wage structure, and renewal date. Generates **KPI** & **Link** blocks. |
| 14 | `candidate_compare` | `candidate.compare` | `GET /api/recruitment/openings/{id}/comparison` | Compares 2–5 applicants against rubric scores and salary expectations. Generates **KPI** & **Table** blocks. |
| 15 | `system_tools_list` | `authenticated` | In-memory Registry | Catalog of live tools available to the current user's session. Generates **List** block. |

---

## 💬 Example Queries & Interactive Behaviors

### 1. Employee Self-Service Queries

#### Leave Balance Inquiry
* **Prompt**: *"How many days of paid leave do I have left?"*
* **Tool Invoked**: `timeoff_get_balance(userId=<caller_id>)`
* **UI Blocks**: 
  - **KPI Block**: `Remaining Days: 14`
  - **Table Block**: Breakdowns for Paid Leave (Allocated: 20, Taken: 6, Remaining: 14), Sick Leave, and Casual Leave.

#### Payslip & Deductions Trace
* **Prompt**: *"Explain the deductions and net pay on my latest payslip."*
* **Tools Invoked**: `payslip_list()`, `payslip_explain(payslipId=12)`
* **UI Blocks**:
  - **KPI Block**: `Net Pay: ₹51,400.00`
  - **Table Block**: Sequenced rule lines showing `BASIC (₹50,000)`, `HRA (₹10,000)`, `PF Deduction (-₹6,000)`, `Professional Tax (-₹3,600)`.
  - **Link Block**: Direct button to view/download the payslip PDF.

#### Current Contract
* **Prompt**: *"What are the key terms and renewal date on my current contract?"*
* **Tool Invoked**: `contract_get_current()`
* **UI Blocks**:
  - **KPI Block**: `Wage: ₹50,000.00 / month`, `Schedule: 40 hrs / week`
  - **Link Block**: Link to view full contract details in the Contracts tab.

---

### 2. HR Manager Queries

#### 360° Employee Dossier
* **Prompt**: *"Give me a 360-degree employee summary for Jordan Lee."*
* **Tools Invoked**: `employee_search(query="Jordan Lee")`, `employee_summary(employeeId=4)`
* **UI Blocks**:
  - **KPI Block**: `Department: Operations`, `Status: Active`, `Attendance Rate: 96.4%`
  - **Link Block**: Clickable deep link to Jordan Lee's employee profile.

#### Expiring Contracts Radar
* **Prompt**: *"Which employee contracts are expiring soon?"*
* **Tool Invoked**: `contract_list_expiring(days=60)`
* **UI Blocks**:
  - **Table Block**: List of expiring contracts with employee name, department, expiration date, and current wage.

#### Attendance Exceptions
* **Prompt**: *"Who has missing check-outs this week?"*
* **Tool Invoked**: `attendance_list_exceptions(exceptionType="MISSING_CHECKOUT")`
* **UI Blocks**:
  - **Table Block**: Filtered records showing date, employee name, scheduled punch times, and manager contact.

---

### 3. HR Payroll Manager & Admin Queries

#### Payrun Pre-Flight Issues Radar
* **Prompt**: *"Is anything blocking the latest payrun from being validated?"*
* **Tools Invoked**: `payrun_list()`, `payrun_list_issues(payrunId=8)`
* **UI Blocks**:
  - **Refusal / Warning Block**: Flags missing bank account for an employee or an overlapping contract.
  - **Action Block**: Recommended action: "Add bank account for Employee #14 before validation".

#### Payrun Batches Overview
* **Prompt**: *"Show recent payruns, their validation status, and total disbursement amounts."*
* **Tool Invoked**: `payrun_list()`
* **UI Blocks**:
  - **Table Block**: Payruns list with period name, employee count, status (`DRAFT`, `COMPUTED`, `VALIDATED`, `PAID`), and total net disbursement.

#### Executive Dashboard KPIs
* **Prompt**: *"Give me an executive KPI overview of current payroll spend and active headcount."*
* **Tool Invoked**: `dashboard_kpis()`
* **UI Blocks**:
  - **KPI Blocks**: `Total Net Paid: ₹1,850,420.00`, `Active Headcount: 40`, `Average Net: ₹46,260.50`, `Attendance Health: 94.2%`.

#### System Capabilities
* **Prompt**: *"What live MCP tools are active and what records can they query?"*
* **Tool Invoked**: `system_tools_list()`
* **UI Blocks**:
  - **List Block**: Dynamic list showing all 15 operational tools and their RBAC status for the session.

---

## 🔒 Security Guarantees

1. **Deny-by-Default Authorization**:
   Tools execute only if the caller's delegated JWT contains the required permission code or `ROLE_ADMIN`. Unauthorized requests return a clean refusal block without querying the backend.
2. **Read-Only by Construction**:
   The `BackendClient` only implements HTTP `GET`. There are no write, update, or delete methods in the entire service.
3. **Dual-View PII Protection**:
   Sensitive fields (`workEmail`, `phone`, `bankAccountNumber`, `panNumber`) are stripped from `model_view` before being passed into the LLM context, preventing training leakage.
4. **Gateway Secret Verification**:
   All communication between Spring Boot and the FastMCP service requires a constant-time HMAC validated `X-Gateway-Secret` header.
5. **Delegated Short-Lived Tokens**:
   The backend mints a per-message token with `aud=mcp`, `act=chat`, `scp=["read"]`, and a 5-minute lifetime. The FastMCP service holds no standing credentials of its own.
6. **Number Grounding**:
   Extracted monetary numbers, percentages, and employee counts mentioned in LLM answers are verified against raw tool output to prevent hallucinations.

---

## 🚀 Running the Service

### 1. Setup Python Virtual Environment
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

### 3. Environment Configuration
Create a `.env` file based on `.env.example`:
```ini
MCP_HOST=127.0.0.1
MCP_PORT=8000
BACKEND_URL=http://127.0.0.1:8080
GATEWAY_SECRET=peoplepay360-mcp-shared-secret-change-in-prod-min-32-chars
AI_PROVIDER=OLLAMA
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:1.7b
```

### 4. Start Development Server
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

* Service Health Check: `http://localhost:8000/health`
* Interactive OpenAPI Docs: `http://localhost:8000/docs`

---

## 🧪 Testing

The MCP test suite includes comprehensive tests for security, PII views, RBAC gates, and conversation loops:

```bash
cd mcp
pytest
```

---

## 🤖 Choosing an AI Model

The assistant requires a model with native **Tool Calling** support:
* **Ollama (Local)**:
  * **`qwen3:1.7b`** (~1.4 GB): Recommended default. Fast (~3s response), low memory, reliable function calling.
  * **`llama3.2:3b`** (~2.0 GB): Strong tool calling accuracy.
  * **`qwen2.5:3b`** (~1.9 GB): High precision tool selection.
  * *Avoid reasoning distillation models (e.g. `deepseek-r1`) which think without invoking tools.*
* **OpenRouter / NVIDIA NIM (Cloud)**:
  * Compatible with `meta-llama/llama-3.3-70b-instruct`, `mistralai/mistral-large`, and `qwen/qwen-2.5-72b-instruct`.
