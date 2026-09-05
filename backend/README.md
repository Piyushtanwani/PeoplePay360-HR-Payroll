# PeoplePay360 Backend

Spring Boot backend for the PeoplePay360 HR and Payroll platform. It is the single system of record and the single security authority: all business rules, payroll computation, PDF and mail, audit, and the chat gateway live here. The React frontend and the Python MCP service are thin clients.

## Stack

Java 21, Spring Boot 3.3, Spring Security (JWT resource server, RS256), Spring Data JPA, Flyway, PostgreSQL 16, exp4j (salary formulas), OpenHTMLtoPDF (payslip PDFs). No Lombok. Build with Maven.

## Prerequisites

- Java 21 or newer
- Maven (the committed `mvnw` wrapper works too)
- A running PostgreSQL 16 with a database and a role the app can use (the role needs rights to create the `btree_gist` extension, i.e. superuser in development)
- Optional for the assistant: Ollama running locally (`ollama pull llama3.1:8b`)

## Build

```
mvn clean package
```

Produces `target/peoplepay360-backend.jar`.

## Run

Create the database, then run with matching environment variables:

```
createdb peoplepay
```

```
export DB_URL=jdbc:postgresql://127.0.0.1:5432/peoplepay
export DB_USER=<your_role>
export DB_PASSWORD=<your_password>
export SPRING_PROFILES_ACTIVE=demo
export APP_ENCRYPTION_KEY=$(python3 -c "import base64,os;print(base64.b64encode(os.urandom(32)).decode())")
mvn spring-boot:run
```

Or run the packaged jar directly:

```
java -jar target/peoplepay360-backend.jar
```

Then:

- API: http://localhost:8080 (Swagger UI at http://localhost:8080/swagger-ui.html)
- Configuration lives in `src/main/resources/application.properties` and the profile files `application-demo.properties` and `application-prod.properties`; every value can be overridden by the environment variables in `.env.example`.

Notes:
- If `APP_ENCRYPTION_KEY` is empty in the demo profile, a fixed development key is derived and a warning is logged. Set a real base64-encoded 32-byte key in production.
- The RS256 signing key is generated on first start and cached at `./keys/jwt.pem`.
- `/actuator/health` reports DOWN when no SMTP server is reachable; this does not affect the API. Point `MAIL_HOST`/`MAIL_PORT` at a mail server to clear it.

## Demo accounts (demo profile, seeded on first start)

| Email | Password | Role |
|---|---|---|
| admin@peoplepay.local | Admin@12345 | Admin |
| hr@peoplepay.local | Hr@12345 | HR Manager |
| payroll@peoplepay.local | Payroll@12345 | HR Payroll User |
| payroll.manager@peoplepay.local | Manager@12345 | HR Payroll Manager |
| employee@peoplepay.local | Employee@12345 | Employee (granted chat.access) |

The seed also creates 40 employees across four departments, the "Standard Monthly" salary structure, running contracts, leave types and holidays, Sam Patel's leave scenario, a Warehouse Supervisor opening with three candidates, and three paid historical payruns (May to July 2026) computed through the real rule engine.

## Quick check

```
curl -s -X POST http://localhost:8080/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@peoplepay.local","password":"Admin@12345"}'
```

Use the returned `accessToken` as `Authorization: Bearer <token>` for all other endpoints. The full endpoint list is in the OpenAPI document at `/v3/api-docs`.

## What is implemented and verified

Verified end to end against PostgreSQL 16:

- Authentication, `/api/auth/me` with the effective permission set, and role-based access control on every endpoint.
- The permission catalogue (83 permissions), five seeded roles, per-user grants, and the grant policy.
- Employees, departments, bank accounts (AES-GCM encrypted, masked, audited unmask), working schedules (auto-computed weekly hours), contracts (period overlap prevented by a database exclusion constraint).
- Attendance (check-in/out, corrections with the self-action guard) and time off (allocations, requests, the NEEDS_ATTENTION rule, allocation approval re-evaluating requests, balances).
- The salary rule engine: sequenced rules with fixed, percentage and formula computation in BigDecimal. Example net for a 50,000 wage: Basic 50,000, HRA 10,000, Transport 1,000, Gross 61,000, PF 6,000, Tax 3,600, Net 51,400.
- The two-step payrun wizard, the pre-validation gate (validate refused with a blocker present, overridable and non-overridable checks), and the state machine Draft to Computed to Validated to Paid to Sent.
- Payslip PDF rendering and asynchronous email with a delivery ledger.
- The live dashboard with server-side redaction (HR Manager receives no payroll figures).
- The chat gateway (mints a per-message delegated token, calls the MCP service, degrades to 503 when the MCP service is down) and AI profile administration.
- Recruitment with the five-stage pipeline and deterministic candidate scoring.

## Package structure

Layered packages under `com.peoplepay360`:

- `model` — JPA entities
- `repository` — Spring Data and custom repositories
- `dto` — request and response records
- `service` — business logic (payroll engine, guards-adjacent domain services, gateways)
- `controller` — REST controllers
- `security` — JWT, RBAC, filters and guards
- `config`, `common` — configuration and cross-cutting infrastructure (audit, errors, encryption)

## Tests

```
mvn test
```

Runs 36 tests: unit tests for the rule engine, formula engine, schedule maths, attendance classification, contract resolver, grant policy, leave balances and candidate scoring; and a full end-to-end integration suite against PostgreSQL (`peoplepay_test`, created and cleaned automatically) covering login, the RBAC matrix, IDOR protection, the payrun wizard and pre-validation gate, override/validate/pay, leave approval, dashboard redaction and the chat fallback. The integration suite needs a reachable PostgreSQL; configure it in `src/test/resources/application-it.yml`.

## Known gaps in this build

- The demo seeder does not yet generate daily attendance rows, so the dashboard attendance-health figure reads zero until attendance exists.
- Historical payruns are produced by `SeedPayrunRunner` using the real rule engine directly rather than through the `PayrunService` HTTP flow, to avoid needing a security context during seeding.
- The integration tests use a local PostgreSQL rather than Testcontainers, because Docker is not assumed to be present in this environment.
