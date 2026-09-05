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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers everything added in the hardening pass: paging and sorting on every list, the salary dry run,
 * rule ordering and activation, CSV export, holiday management, contract templates, onboarding,
 * self-service and the two new dashboards.
 *
 * <p>Shares the Spring context with {@link BackendIT}, which is why nothing here asserts a
 * global row count: the other class creates a payrun of its own.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"demo", "it"})
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class HardeningIT {

    @LocalServerPort int port;
    @Autowired TestRestTemplate rest;
    @Autowired ObjectMapper mapper;

    private static final Map<String, String> TOKENS = new java.util.concurrent.ConcurrentHashMap<>();

    /**
     * The default client is built on HttpURLConnection, which rejects PATCH outright and cannot read the
     * body of a 401. The JDK HTTP client handles both, which this suite needs for the rule toggle and
     * for asserting that an old password stops working.
     */
    @BeforeEach
    void useAClientThatSupportsEveryMethod() {
        rest.getRestTemplate().setRequestFactory(
                new org.springframework.http.client.JdkClientHttpRequestFactory());
    }

    private String base() { return "http://localhost:" + port; }

    private String admin() { return token("admin@peoplepay.local", "Admin@12345"); }
    private String payrollManager() { return token("payroll.manager@peoplepay.local", "Manager@12345"); }
    private String payrollUser() { return token("payroll@peoplepay.local", "Payroll@12345"); }
    private String hrManager() { return token("hr@peoplepay.local", "Hr@12345"); }
    private String employee() { return token("employee@peoplepay.local", "Employee@12345"); }

    private String token(String email, String password) {
        return TOKENS.computeIfAbsent(email, k -> {
            ResponseEntity<String> res = rest.postForEntity(base() + "/api/auth/login",
                    Map.of("email", email, "password", password), String.class);
            assertThat(res.getStatusCode()).as("sign in as %s", email).isEqualTo(HttpStatus.OK);
            return read(res.getBody()).get("accessToken").asText();
        });
    }

    private HttpHeaders auth(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }

    private JsonNode read(String body) {
        try { return mapper.readTree(body); } catch (Exception e) { throw new RuntimeException(e); }
    }

    private ResponseEntity<String> exchange(String path, HttpMethod method, String token, Object body) {
        return rest.exchange(base() + path, method, new HttpEntity<>(body, auth(token)), String.class);
    }

    private ResponseEntity<String> get(String path, String token) {
        return exchange(path, HttpMethod.GET, token, null);
    }

    private JsonNode getJson(String path, String token) {
        ResponseEntity<String> res = get(path, token);
        assertThat(res.getStatusCode()).as("GET %s", path).isEqualTo(HttpStatus.OK);
        return read(res.getBody());
    }

    private String errorCode(ResponseEntity<String> res) {
        return read(res.getBody()).path("code").asText();
    }

    private long firstStructureId() {
        return getJson("/api/salary-structures/names", payrollManager()).get(0).get("id").asLong();
    }

    // ---------------------------------------------------------------- paging

    @Test @Order(1)
    void everyListReturnsAPageEnvelopeWithADefaultSize() {
        String t = admin();
        for (String path : List.of("/api/employees", "/api/contracts", "/api/payruns", "/api/payslips",
                "/api/schedules", "/api/salary-structures", "/api/salary-structures/rules/all",
                "/api/timeoff/requests", "/api/timeoff/allocations", "/api/admin/users", "/api/admin/audit")) {
            JsonNode page = getJson(path, t);
            assertThat(page.has("content")).as("%s returns a page envelope", path).isTrue();
            assertThat(page.get("size").asInt()).as("%s default page size", path).isEqualTo(20);
            assertThat(page.get("content").size()).isLessThanOrEqualTo(20);
        }
    }

    @Test @Order(2)
    void anOversizedPageIsClampedRatherThanHonoured() {
        JsonNode page = getJson("/api/employees?size=100000", admin());
        assertThat(page.get("size").asInt()).isEqualTo(200);
    }

    @Test @Order(3)
    void anUnknownSortFieldIsRefusedWithABadRequest() {
        ResponseEntity<String> res = get("/api/employees?sort=passwordHash,asc", admin());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(errorCode(res)).isEqualTo("VALIDATION_ERROR");
        assertThat(res.getBody()).contains("displayName");
    }

    @Test @Order(4)
    void sortingIsAppliedInBothDirections() {
        JsonNode asc = getJson("/api/employees?sort=displayName,asc&size=5", admin()).get("content");
        JsonNode desc = getJson("/api/employees?sort=displayName,desc&size=5", admin()).get("content");
        assertThat(asc.get(0).get("displayName").asText())
                .isLessThan(asc.get(4).get("displayName").asText());
        assertThat(desc.get(0).get("displayName").asText())
                .isGreaterThan(asc.get(0).get("displayName").asText());
    }

    @Test @Order(5)
    void payrunsComeBackNewestPeriodFirst() {
        JsonNode rows = getJson("/api/payruns", payrollManager()).get("content");
        assertThat(rows.size()).isGreaterThanOrEqualTo(2);
        for (int i = 1; i < rows.size(); i++) {
            assertThat(rows.get(i - 1).get("periodStart").asText())
                    .isGreaterThanOrEqualTo(rows.get(i).get("periodStart").asText());
        }
    }

    @Test @Order(6)
    void searchingContractsMatchesTheEmployeeName() {
        JsonNode page = getJson("/api/contracts?q=Sam", hrManager());
        assertThat(page.get("totalElements").asInt()).isGreaterThanOrEqualTo(1);
        assertThat(page.get("content").get(0).get("employeeName").asText()).contains("Sam");
    }

    @Test @Order(7)
    void theAttendanceDepartmentFilterActuallyNarrows() {
        long departmentId = getJson("/api/departments", hrManager()).get(0).get("id").asLong();
        int all = getJson("/api/attendance?size=1", hrManager()).get("totalElements").asInt();
        int filtered = getJson("/api/attendance?size=1&departmentId=" + departmentId, hrManager())
                .get("totalElements").asInt();
        assertThat(all).isPositive();
        assertThat(filtered).isPositive().isLessThan(all);
    }

    // ------------------------------------------------------- attendance rules

    @Test @Order(10)
    void theAttendanceRulesEndpointReportsTheConfiguredThresholds() {
        JsonNode rules = getJson("/api/attendance/rules", hrManager());
        assertThat(rules.get("lateGraceMinutes").asInt()).isEqualTo(10);
        assertThat(rules.get("overtimeThresholdMinutes").asInt()).isEqualTo(30);
        assertThat(rules.get("statuses").size()).isEqualTo(5);
        assertThat(rules.get("edgeCases").size()).isGreaterThanOrEqualTo(5);
    }

    @Test @Order(11)
    void resolvingAnExceptionRecordsWhoDidItAndWhy() {
        String period = java.time.YearMonth.now().toString();
        JsonNode open = getJson("/api/attendance/exceptions?period=" + period + "&resolved=false&size=50",
                hrManager()).get("content");
        Assumptions.assumeTrue(open.size() > 0, "no unresolved exceptions in the current month");

        JsonNode target = null;
        for (JsonNode e : open) {
            // Nobody may resolve their own row, so skip the HR manager's own employee record.
            if (!"Morgan Diaz".equals(e.get("employeeName").asText())) { target = e; break; }
        }
        Assumptions.assumeTrue(target != null, "only own-record exceptions available");
        long id = target.get("id").asLong();

        ResponseEntity<String> noReason = exchange("/api/attendance/exceptions/" + id + "/resolve",
                HttpMethod.POST, hrManager(), Map.of());
        assertThat(noReason.getStatusCode()).as("a resolution must say why").isEqualTo(HttpStatus.BAD_REQUEST);

        ResponseEntity<String> res = exchange("/api/attendance/exceptions/" + id + "/resolve",
                HttpMethod.POST, hrManager(), Map.of("reason", "Confirmed with the line manager."));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = read(res.getBody());
        assertThat(body.get("resolved").asBoolean()).isTrue();
        assertThat(body.get("resolutionNote").asText()).isEqualTo("Confirmed with the line manager.");
        assertThat(body.get("resolvedBy").isNull()).isFalse();
        assertThat(body.get("resolvedAt").isNull()).isFalse();
    }

    @Test @Order(12)
    void aTimeOnlyCheckOutIsRefusedRatherThanSilentlyIgnored() {
        String period = java.time.YearMonth.now().toString();
        JsonNode open = getJson("/api/attendance/exceptions?period=" + period + "&size=50", hrManager())
                .get("content");
        Assumptions.assumeTrue(open.size() > 0, "no exceptions this month");
        long id = open.get(0).get("id").asLong();
        ResponseEntity<String> res = exchange("/api/attendance/exceptions/" + id + "/resolve",
                HttpMethod.POST, hrManager(), Map.of("checkOut", "17:30", "reason", "Closing the day."));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // ------------------------------------------------------------- salary rules

    @Test @Order(20)
    void theDryRunSimulatesWithoutPersistingAnything() {
        long structureId = firstStructureId();
        int before = getJson("/api/payslips?size=1", payrollManager()).get("totalElements").asInt();

        JsonNode result = read(exchange("/api/salary-structures/" + structureId + "/dry-run", HttpMethod.POST,
                payrollManager(), Map.of("period", "2026-07")).getBody());
        assertThat(result.get("results").size()).isGreaterThan(0);
        JsonNode totals = result.get("totals");
        assertThat(totals.get("totalNewNet").decimalValue().signum()).isPositive();
        assertThat(totals.get("negativeEmployeeIds").size()).isZero();

        int after = getJson("/api/payslips?size=1", payrollManager()).get("totalElements").asInt();
        assertThat(after).as("a dry run writes nothing").isEqualTo(before);
    }

    @Test @Order(21)
    void aRuleSetThatDrivesPayNegativeIsReportedRatherThanAccepted() {
        long structureId = firstStructureId();
        String mgr = payrollManager();
        JsonNode rule = read(exchange("/api/salary-structures/" + structureId + "/rules", HttpMethod.POST, mgr,
                Map.of("name", "Temporary huge deduction", "code", "TEMP_HUGE", "category", "DEDUCTION",
                        "sequence", 85, "computeType", "FIXED", "fixedAmount", 9_999_999)).getBody());
        long ruleId = rule.get("id").asLong();
        try {
            JsonNode result = read(exchange("/api/salary-structures/" + structureId + "/dry-run", HttpMethod.POST,
                    mgr, Map.of("period", "2026-07")).getBody());
            JsonNode totals = result.get("totals");
            assertThat(totals.get("negativeEmployeeIds").size()).isPositive();
            assertThat(totals.get("totalNewNet").decimalValue().signum()).isNegative();
            boolean warned = false;
            for (JsonNode w : totals.get("warnings")) {
                if (w.asText().contains("negative net")) warned = true;
            }
            assertThat(warned).as("the totals explain the negative outcome").isTrue();
        } finally {
            exchange("/api/salary-structures/" + structureId + "/rules/" + ruleId, HttpMethod.DELETE, mgr, null);
        }
    }

    @Test @Order(22)
    void aPayrollUserMayReadTheFormulaHelpButNotRunASimulation() {
        assertThat(get("/api/salary-structures/formula-help", payrollUser()).getStatusCode())
                .as("the reference panel follows read access").isEqualTo(HttpStatus.OK);
        assertThat(exchange("/api/salary-structures/" + firstStructureId() + "/dry-run", HttpMethod.POST,
                payrollUser(), Map.of("period", "2026-07")).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test @Order(23)
    void reorderingRenumbersTheRulesAndRefusesAPartialList() {
        long structureId = firstStructureId();
        String mgr = payrollManager();
        JsonNode structure = getJson("/api/salary-structures/" + structureId, mgr);
        List<Long> ids = new ArrayList<>();
        for (JsonNode r : structure.get("rules")) ids.add(r.get("id").asLong());

        ResponseEntity<String> partial = exchange("/api/salary-structures/" + structureId + "/rules/reorder",
                HttpMethod.PUT, mgr, Map.of("orderedRuleIds", ids.subList(0, 2)));
        assertThat(partial.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        JsonNode reordered = read(exchange("/api/salary-structures/" + structureId + "/rules/reorder",
                HttpMethod.PUT, mgr, Map.of("orderedRuleIds", ids)).getBody());
        int expected = 10;
        for (JsonNode r : reordered.get("rules")) {
            assertThat(r.get("sequence").asInt()).isEqualTo(expected);
            expected += 10;
        }
    }

    @Test @Order(24)
    void aRuleOtherRulesDependOnCannotBeSwitchedOff() {
        long structureId = firstStructureId();
        String mgr = payrollManager();
        Long basicId = null;
        Long transportId = null;
        for (JsonNode r : getJson("/api/salary-structures/" + structureId, mgr).get("rules")) {
            if ("BASIC".equals(r.get("code").asText())) basicId = r.get("id").asLong();
            if ("TRANSPORT".equals(r.get("code").asText())) transportId = r.get("id").asLong();
        }
        assertThat(basicId).isNotNull();

        ResponseEntity<String> refused = exchange(
                "/api/salary-structures/" + structureId + "/rules/" + basicId + "/active",
                HttpMethod.PATCH, mgr, Map.of("active", false));
        assertThat(refused.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(errorCode(refused)).isEqualTo("ILLEGAL_STATE");

        // A leaf rule can be switched off and back on again.
        assertThat(exchange("/api/salary-structures/" + structureId + "/rules/" + transportId + "/active",
                HttpMethod.PATCH, mgr, Map.of("active", false)).getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode reactivated = read(exchange(
                "/api/salary-structures/" + structureId + "/rules/" + transportId + "/active",
                HttpMethod.PATCH, mgr, Map.of("active", true)).getBody());
        assertThat(reactivated.get("active").asBoolean()).isTrue();
    }

    @Test @Order(25)
    void aStructureInUseCannotBeDeleted() {
        ResponseEntity<String> res = exchange("/api/salary-structures/" + firstStructureId(),
                HttpMethod.DELETE, payrollManager(), null);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(res.getBody()).contains("structure");
    }

    // ---------------------------------------------------------------- exports

    @Test @Order(30)
    void thePayrunExportIsCsvWithMaskedAccountNumbers() {
        long paidPayrunId = getJson("/api/payruns?state=PAID", payrollManager())
                .get("content").get(0).get("id").asLong();
        ResponseEntity<String> res = get("/api/payruns/" + paidPayrunId + "/export.csv", payrollManager());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION)).contains(".csv");

        String[] lines = res.getBody().split("\r\n");
        assertThat(lines[0]).startsWith("Payslip ID,Employee No,Employee");
        assertThat(lines.length).isGreaterThan(1);
        assertThat(res.getBody()).contains("****");
        assertThat(res.getBody()).doesNotContain("ACC");
    }

    @Test @Order(31)
    void exportingAPayrunNeedsTheExportPermission() {
        long paidPayrunId = getJson("/api/payruns?state=PAID", payrollManager())
                .get("content").get(0).get("id").asLong();
        assertThat(get("/api/payruns/" + paidPayrunId + "/export.csv", payrollUser()).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test @Order(32)
    void theAuditExportHonoursTheFiltersOnScreen() {
        ResponseEntity<String> res = get("/api/admin/audit/export.csv?outcome=DENY", admin());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).startsWith("id,occurredAt,actor");
        assertThat(res.getBody()).doesNotContain(",ALLOW,");
    }

    // --------------------------------------------------------------- holidays

    @Test @Order(40)
    void holidaysCanBeAddedAndRemovedButNotDuplicated() {
        String hr = hrManager();
        Map<String, Object> body = Map.of("date", "2026-12-25", "name", "Christmas Day");

        ResponseEntity<String> created = exchange("/api/timeoff/holidays", HttpMethod.POST, hr, body);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.OK);
        long id = read(created.getBody()).get("id").asLong();

        ResponseEntity<String> duplicate = exchange("/api/timeoff/holidays", HttpMethod.POST, hr, body);
        assertThat(duplicate.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(errorCode(duplicate)).isEqualTo("DUPLICATE");

        assertThat(exchange("/api/timeoff/holidays", HttpMethod.POST, hr,
                Map.of("date", "2026-12-26", "name", " ")).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        assertThat(exchange("/api/timeoff/holidays/" + id, HttpMethod.DELETE, hr, null).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(exchange("/api/timeoff/holidays/" + id, HttpMethod.DELETE, hr, null).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test @Order(41)
    void anEmployeeCannotManageHolidays() {
        assertThat(exchange("/api/timeoff/holidays", HttpMethod.POST, employee(),
                Map.of("date", "2026-11-11", "name", "Nope")).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    // ------------------------------------------------------ templates and onboarding

    @Test @Order(50)
    void aContractTemplateBecomesARunningContractAndALogin() {
        String hr = hrManager();
        long scheduleId = getJson("/api/schedules/names", hr).get(0).get("id").asLong();
        long structureId = getJson("/api/salary-structures/names", payrollManager()).get(0).get("id").asLong();
        long departmentId = getJson("/api/departments", hr).get(0).get("id").asLong();

        JsonNode template = read(exchange("/api/contract-templates", HttpMethod.POST, hr,
                Map.of("name", "Warehouse standard", "wage", 42000, "wageType", "MONTHLY",
                        "workingScheduleId", scheduleId, "salaryStructureId", structureId,
                        "jobTitle", "Warehouse Operative")).getBody());
        long templateId = template.get("id").asLong();
        assertThat(template.get("salaryStructureName").asText()).isNotEmpty();

        assertThat(exchange("/api/contract-templates", HttpMethod.POST, hr,
                Map.of("name", "Warehouse standard", "wage", 1)).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(exchange("/api/contract-templates", HttpMethod.POST, hr,
                Map.of("name", "Bad wage", "wage", 0)).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        String email = "onboarded." + System.nanoTime() + "@peoplepay.local";
        Map<String, Object> newEmployee = new HashMap<>();
        newEmployee.put("displayName", "Onboarding Test");
        newEmployee.put("departmentId", departmentId);
        newEmployee.put("employeeType", "FULL_TIME");
        newEmployee.put("hireDate", "2026-09-01");
        newEmployee.put("workEmail", email);
        newEmployee.put("jobTitle", "Warehouse Operative");
        newEmployee.put("roleCode", "EMPLOYEE");
        newEmployee.put("contractTemplateId", templateId);

        JsonNode created = read(exchange("/api/employees", HttpMethod.POST, hr, newEmployee).getBody());
        long employeeId = created.get("id").asLong();
        assertThat(created.get("roleCode").asText()).isEqualTo("EMPLOYEE");
        assertThat(created.get("onboarding").get("contractId").isNull()).isFalse();
        assertThat(created.get("onboarding").get("userId").isNull()).isFalse();
        assertThat(created.get("onboarding").get("inviteMessage").asText()).isNotEmpty();

        JsonNode contracts = getJson("/api/contracts?employeeId=" + employeeId, hr).get("content");
        assertThat(contracts.size()).isEqualTo(1);
        assertThat(contracts.get(0).get("state").asText()).isEqualTo("RUNNING");
        assertThat(contracts.get(0).get("wage").decimalValue().intValue()).isEqualTo(42000);

        // A second login for the same person is refused rather than silently creating a duplicate.
        assertThat(exchange("/api/employees/" + employeeId + "/login", HttpMethod.POST, hr,
                Map.of("roleCode", "EMPLOYEE")).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        assertThat(exchange("/api/contract-templates/" + templateId, HttpMethod.DELETE, hr, null)
                .getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test @Order(51)
    void anEmployeeCanBeCreatedWithoutALoginOrAContract() {
        JsonNode created = read(exchange("/api/employees", HttpMethod.POST, hrManager(),
                Map.of("displayName", "No Login Person", "employeeType", "CONTRACT")).getBody());
        assertThat(created.get("roleCode").isNull()).isTrue();
        assertThat(created.get("onboarding").get("userId").isNull()).isTrue();
        assertThat(created.get("onboarding").get("contractId").isNull()).isTrue();
    }

    @Test @Order(52)
    void onlyAnAdministratorMayCreateAnotherAdministrator() {
        ResponseEntity<String> res = exchange("/api/employees", HttpMethod.POST, hrManager(),
                Map.of("displayName", "Would-be admin", "workEmail", "wouldbe." + System.nanoTime() + "@peoplepay.local",
                        "roleCode", "ADMIN"));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test @Order(53)
    void creatingALoginNeedsAWorkEmail() {
        JsonNode created = read(exchange("/api/employees", HttpMethod.POST, hrManager(),
                Map.of("displayName", "Emailless Person")).getBody());
        ResponseEntity<String> res = exchange("/api/employees/" + created.get("id").asLong() + "/login",
                HttpMethod.POST, hrManager(), Map.of("roleCode", "EMPLOYEE"));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(res.getBody()).contains("work email");
    }

    // ----------------------------------------------------------- self service

    @Test @Order(60)
    void aPersonCanReadAndRenameTheirOwnProfile() {
        String emp = employee();
        JsonNode profile = getJson("/api/me/profile", emp);
        assertThat(profile.get("user").get("email").asText()).isEqualTo("employee@peoplepay.local");
        assertThat(profile.get("employee").get("employeeNo").asText()).isNotEmpty();
        assertThat(profile.get("passwordRule").asText()).contains("10");

        String original = profile.get("user").get("displayName").asText();
        JsonNode renamed = read(exchange("/api/me/profile", HttpMethod.PUT, emp,
                Map.of("displayName", "Sam P.")).getBody());
        assertThat(renamed.get("user").get("displayName").asText()).isEqualTo("Sam P.");
        assertThat(renamed.get("employee").get("displayName").asText())
                .as("the login and the employee record stay in step").isEqualTo("Sam P.");

        exchange("/api/me/profile", HttpMethod.PUT, emp, Map.of("displayName", original));
    }

    @Test @Order(61)
    void changingOwnBankDetailsRequiresTheCurrentPassword() {
        String emp = employee();
        assertThat(exchange("/api/me/bank-account", HttpMethod.PUT, emp,
                Map.of("bankName", "Fraud Bank", "accountNumber", "999900001111",
                        "currentPassword", "not-my-password")).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        JsonNode updated = read(exchange("/api/me/bank-account", HttpMethod.PUT, emp,
                Map.of("bankName", "State Bank", "accountNumber", "1234 5678 9012", "ifsc", "SBIN0001234",
                        "currentPassword", "Employee@12345")).getBody());
        assertThat(updated.get("bankAccount").get("accountLast4").asText()).isEqualTo("9012");
        assertThat(updated.toString()).as("the full number never comes back").doesNotContain("123456789012");
    }

    @Test @Order(62)
    void changingOwnPasswordIsCheckedAndThenWorks() {
        String email = "pwtest." + System.nanoTime() + "@peoplepay.local";
        JsonNode created = read(exchange("/api/admin/users", HttpMethod.POST, admin(),
                Map.of("email", email, "displayName", "Password Tester", "roleCode", "EMPLOYEE",
                        "password", "Initial-Pass-1", "sendInvite", false)).getBody());
        assertThat(created.get("user").get("id").asLong()).isPositive();

        String own = read(rest.postForEntity(base() + "/api/auth/login",
                Map.of("email", email, "password", "Initial-Pass-1"), String.class).getBody())
                .get("accessToken").asText();

        assertThat(exchange("/api/me/change-password", HttpMethod.POST, own,
                Map.of("currentPassword", "wrong", "newPassword", "Another-Pass-2")).getStatusCode())
                .as("a wrong current password is a validation error, not a session expiry")
                .isEqualTo(HttpStatus.BAD_REQUEST);

        assertThat(exchange("/api/me/change-password", HttpMethod.POST, own,
                Map.of("currentPassword", "Initial-Pass-1", "newPassword", "short")).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        assertThat(exchange("/api/me/change-password", HttpMethod.POST, own,
                Map.of("currentPassword", "Initial-Pass-1", "newPassword", "Another-Pass-2")).getStatusCode())
                .isEqualTo(HttpStatus.OK);

        assertThat(rest.postForEntity(base() + "/api/auth/login",
                Map.of("email", email, "password", "Initial-Pass-1"), String.class).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(rest.postForEntity(base() + "/api/auth/login",
                Map.of("email", email, "password", "Another-Pass-2"), String.class).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    // ------------------------------------------------------------- dashboards

    @Test @Order(70)
    void anEmployeeGetsTheirOwnDashboardEvenThoughTheHrOneIsClosedToThem() {
        String emp = employee();
        assertThat(get("/api/reports/dashboard?period=2026-07", emp).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);

        JsonNode mine = getJson("/api/reports/dashboard/me", emp);
        assertThat(mine.get("displayName").asText()).isNotEmpty();
        assertThat(mine.get("recentPayslips").size()).isGreaterThan(0);
        assertThat(mine.has("leaveBalances")).isTrue();
        assertThat(mine.get("contract").get("reference").asText()).startsWith("C-");
        assertThat(mine.get("contract").has("wage")).as("pay figures stay off the summary").isFalse();
        assertThat(mine.toString()).doesNotContain("totalNetPaid");
    }

    @Test @Order(71)
    void theAdminBlockIsPresentForAdministratorsAndAbsentForEveryoneElse() {
        JsonNode adminView = getJson("/api/reports/dashboard?period=2026-07", admin());
        JsonNode block = adminView.get("admin");
        assertThat(block.isNull()).isFalse();
        assertThat(block.get("activeUsers").asInt()).isGreaterThanOrEqualTo(5);

        JsonNode hrView = getJson("/api/reports/dashboard?period=2026-07", hrManager());
        assertThat(hrView.get("admin").isNull()).as("HR never sees the identity tiles").isTrue();
        assertThat(hrView.get("kpis").get("totalNetPaid").isNull())
                .as("payroll figures stay redacted for HR").isTrue();
        assertThat(hrView.get("headcount").asInt()).isPositive();
    }

    @Test @Order(72)
    void theHealthCheckReportsWhetherMailIsActuallyListening() {
        JsonNode health = getJson("/api/admin/health", admin());
        assertThat(health.get("db").asBoolean()).isTrue();
        assertThat(health.get("mail").has("reachable"))
                .as("mail is measured, not assumed").isTrue();
    }
}
