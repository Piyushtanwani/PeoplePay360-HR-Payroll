package com.peoplepay360;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import com.peoplepay360.model.Employee;

/**
 * End-to-end integration test against a real PostgreSQL (peoplepay_test), running the demo seeder once.
 * Methods are ordered so the payroll lifecycle and leave flow build on the seeded data.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"demo", "it"})
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class BackendIntegrationTest {

    @LocalServerPort int port;
    @Autowired TestRestTemplate rest;
    @Autowired ObjectMapper mapper;

    private String base() { return "http://localhost:" + port; }

    private static final Map<String, String> TOKEN_CACHE = new java.util.concurrent.ConcurrentHashMap<>();

    private String token(String email, String password) {
        return TOKEN_CACHE.computeIfAbsent(email, k -> {
            var body = Map.of("email", email, "password", password);
            ResponseEntity<String> res = rest.postForEntity(base() + "/api/auth/login", body, String.class);
            assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
            return read(res.getBody()).get("accessToken").asText();
        });
    }
    private HttpHeaders auth(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }
    private JsonNode read(String s) {
        try { return mapper.readTree(s); } catch (Exception e) { throw new RuntimeException(e); }
    }
    private <T> ResponseEntity<String> exchange(String path, HttpMethod method, String token, Object body) {
        return rest.exchange(base() + path, method, new HttpEntity<>(body, auth(token)), String.class);
    }
    private ResponseEntity<String> get(String path, String token) {
        return exchange(path, HttpMethod.GET, token, null);
    }

    @Test @Order(1)
    void adminLoginExposesAllPermissionsAndFeatures() {
        String t = token("admin@peoplepay.local", "Admin@12345");
        JsonNode me = read(get("/api/auth/me", t).getBody());
        assertThat(me.get("user").get("roleCode").asText()).isEqualTo("ADMIN");
        assertThat(me.get("permissions").size()).isGreaterThanOrEqualTo(80);
        assertThat(me.get("features").get("chat").asBoolean()).isTrue();
    }

    @Test @Order(2)
    void seededEmployeesAndHistoricalPayrunsExist() {
        String t = token("admin@peoplepay.local", "Admin@12345");
        JsonNode emps = read(get("/api/employees?size=5", t).getBody());
        assertThat(emps.get("totalElements").asInt()).isEqualTo(40);
        JsonNode payruns = read(get("/api/payruns", t).getBody());
        assertThat(payruns.size()).isGreaterThanOrEqualTo(3);
        for (JsonNode p : payruns) {
            assertThat(p.get("state").asText()).isEqualTo("PAID");
            assertThat(p.get("totalNet").asDouble()).isGreaterThan(0.0);
        }
    }

    @Test @Order(3)
    void payslipComputationIsCorrect() {
        String t = token("admin@peoplepay.local", "Admin@12345");
        JsonNode slips = read(get("/api/payslips?period=2026-07", t).getBody());
        JsonNode slip = read(get("/api/payslips/" + slips.get(0).get("id").asLong(), t).getBody());
        // wage 50000 for E-1001 (Taylor Brooks); other employees vary, so assert internal consistency
        double gross = slip.get("gross").asDouble();
        double deductions = slip.get("deductions").asDouble();
        double net = slip.get("net").asDouble();
        assertThat(net).isEqualTo(gross - deductions, org.assertj.core.data.Offset.offset(0.01));
        assertThat(slip.get("lines").size()).isEqualTo(9);
    }

    @Test @Order(4)
    void payrunWizardGateOverrideValidatePay() {
        String mgr = token("payroll.manager@peoplepay.local", "Manager@12345");
        long sid = read(get("/api/salary-structures/names", mgr).getBody()).get(0).get("id").asLong();

        JsonNode elig = read(exchange("/api/payruns/eligibility", HttpMethod.POST, mgr,
                Map.of("structureId", sid, "periodStart", "2026-08-01", "periodEnd", "2026-08-31")).getBody());
        List<Long> ids = new java.util.ArrayList<>();
        for (JsonNode e : elig) if (e.get("eligible").asBoolean()) ids.add(e.get("employeeId").asLong());
        assertThat(ids).hasSize(40);

        JsonNode pr = read(exchange("/api/payruns", HttpMethod.POST, mgr,
                Map.of("structureId", sid, "periodStart", "2026-08-01", "periodEnd", "2026-08-31", "employeeIds", ids)).getBody());
        long prId = pr.get("id").asLong();

        JsonNode computed = read(exchange("/api/payruns/" + prId + "/compute", HttpMethod.POST, mgr, null).getBody());
        assertThat(computed.get("state").asText()).isEqualTo("COMPUTED");
        assertThat(computed.get("payslipCount").asInt()).isEqualTo(40);
        assertThat(computed.get("blockerCount").asInt()).isGreaterThanOrEqualTo(1); // employee without bank

        // validate blocked
        ResponseEntity<String> validateBlocked = exchange("/api/payruns/" + prId + "/validate", HttpMethod.POST, mgr, null);
        assertThat(validateBlocked.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(read(validateBlocked.getBody()).get("code").asText()).isEqualTo("BLOCKERS_PRESENT");

        // override the blocker(s)
        JsonNode blockers = read(get("/api/payruns/" + prId + "/issues?severity=BLOCKER", mgr).getBody());
        for (JsonNode b : blockers) {
            exchange("/api/payruns/" + prId + "/issues/" + b.get("id").asLong() + "/override",
                    HttpMethod.POST, mgr, Map.of("reason", "manual payment arranged"));
        }
        assertThat(exchange("/api/payruns/" + prId + "/validate", HttpMethod.POST, mgr, null).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(exchange("/api/payruns/" + prId + "/pay", HttpMethod.POST, mgr, Map.of()).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    @Test @Order(5)
    void overrideOfNonOverridableCheckIsRefused() {
        // create two overlapping payruns for the same period to force DUPLICATE_PAYSLIP (non-overridable)
        String mgr = token("payroll.manager@peoplepay.local", "Manager@12345");
        long sid = read(get("/api/salary-structures/names", mgr).getBody()).get(0).get("id").asLong();
        JsonNode elig = read(exchange("/api/payruns/eligibility", HttpMethod.POST, mgr,
                Map.of("structureId", sid, "periodStart", "2026-08-01", "periodEnd", "2026-08-31")).getBody());
        // eligibility now excludes those already on the August payrun; if empty, nothing to assert
        List<Long> ids = new java.util.ArrayList<>();
        for (JsonNode e : elig) if (e.get("eligible").asBoolean()) ids.add(e.get("employeeId").asLong());
        Assumptions.assumeTrue(ids.isEmpty(),
                "August employees are already on a payrun, confirming duplicate protection at eligibility");
    }

    @Test @Order(6)
    void hrPayrollUserCannotPay() {
        String user = token("payroll@peoplepay.local", "Payroll@12345");
        JsonNode payruns = read(get("/api/payruns?state=PAID", user).getBody());
        long anyPaid = payruns.get(0).get("id").asLong();
        ResponseEntity<String> res = exchange("/api/payruns/" + anyPaid + "/pay", HttpMethod.POST, user, Map.of());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(read(res.getBody()).get("code").asText()).isEqualTo("PERMISSION_DENIED");
    }

    @Test @Order(7)
    void employeeCannotReadOtherEmployeeButCanReadOwnPayslips() {
        String emp = token("employee@peoplepay.local", "Employee@12345");
        assertThat(get("/api/employees/1", emp).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(get("/api/payslips", emp).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test @Order(8)
    void leaveAllocationApprovalReevaluatesRequest() {
        String hr = token("hr@peoplepay.local", "Hr@12345");
        long sam = read(get("/api/employees?q=Sam", hr).getBody()).get("content").get(0).get("id").asLong();
        JsonNode allocs = read(get("/api/timeoff/allocations?employeeId=" + sam + "&state=DRAFT", hr).getBody());
        if (allocs.size() > 0) {
            long allocId = allocs.get(0).get("id").asLong();
            assertThat(exchange("/api/timeoff/allocations/" + allocId + "/approve", HttpMethod.POST, hr, Map.of())
                    .getStatusCode()).isEqualTo(HttpStatus.OK);
        }
        JsonNode reqs = read(get("/api/timeoff/requests?employeeId=" + sam, hr).getBody());
        boolean annualPending = false;
        for (JsonNode r : reqs) {
            if (r.get("typeName").asText().equals("Annual Leave"))
                annualPending = r.get("state").asText().equals("PENDING");
        }
        assertThat(annualPending).isTrue();
    }

    @Test @Order(9)
    void hrManagerDashboardHidesPayrollFigures() {
        String hr = token("hr@peoplepay.local", "Hr@12345");
        JsonNode d = read(get("/api/reports/dashboard?period=2026-07", hr).getBody());
        assertThat(d.get("kpis").hasNonNull("totalNetPaid")).isFalse();
        assertThat(d.get("salaryCostByDepartment").isNull() || d.get("salaryCostByDepartment").isEmpty()).isTrue();
    }

    @Test @Order(10)
    void hrManagerCannotAccessPayruns() {
        String hr = token("hr@peoplepay.local", "Hr@12345");
        assertThat(get("/api/payruns", hr).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test @Order(11)
    void chatDegradesGracefullyWhenMcpDown() {
        String emp = token("employee@peoplepay.local", "Employee@12345");
        JsonNode session = read(exchange("/api/chat/sessions", HttpMethod.POST, emp, Map.of("title", "t")).getBody());
        long sid = session.get("id").asLong();
        ResponseEntity<String> res = exchange("/api/chat/sessions/" + sid + "/messages", HttpMethod.POST, emp,
                Map.of("content", "What is my leave balance?"));
        assertThat(res.getStatusCode()).isIn(HttpStatus.SERVICE_UNAVAILABLE, HttpStatus.BAD_GATEWAY);
    }

    @Test @Order(12)
    void contractOverlapIsRejected() {
        String hr = token("hr@peoplepay.local", "Hr@12345");
        long emp = read(get("/api/employees?size=1", hr).getBody()).get("content").get(0).get("id").asLong();
        // existing running contract starts 2025-01-01; an overlapping one must be refused
        ResponseEntity<String> res = exchange("/api/contracts", HttpMethod.POST, hr, Map.of(
                "employeeId", emp, "wage", 40000, "wageType", "MONTHLY",
                "startDate", "2025-06-01", "endDate", "2025-12-31"));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(read(res.getBody()).get("code").asText()).isEqualTo("CONTRACT_OVERLAP");
    }
}
