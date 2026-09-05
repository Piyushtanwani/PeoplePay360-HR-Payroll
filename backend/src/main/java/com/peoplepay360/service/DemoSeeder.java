package com.peoplepay360.service;

import com.peoplepay360.model.Contract;
import com.peoplepay360.repository.ContractRepository;
import com.peoplepay360.repository.ContractTemplateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.*;
import com.peoplepay360.model.AppUser;
import com.peoplepay360.model.Candidate;
import com.peoplepay360.model.CandidateIdentity;
import com.peoplepay360.model.ContractTemplate;
import com.peoplepay360.model.Department;
import com.peoplepay360.model.Employee;
import com.peoplepay360.model.EmployeeBankAccount;
import com.peoplepay360.model.JobOpening;
import com.peoplepay360.model.PublicHoliday;
import com.peoplepay360.model.Role;
import com.peoplepay360.model.SalaryRule;
import com.peoplepay360.model.SalaryStructure;
import com.peoplepay360.model.TimeOffAllocation;
import com.peoplepay360.model.TimeOffRequest;
import com.peoplepay360.model.TimeOffType;
import com.peoplepay360.model.UserPermissionGrant;
import com.peoplepay360.model.WorkingSchedule;
import com.peoplepay360.model.WorkingScheduleLine;
import com.peoplepay360.repository.AppUserRepository;
import com.peoplepay360.repository.CandidateIdentityRepository;
import com.peoplepay360.repository.CandidateRepository;
import com.peoplepay360.repository.DepartmentRepository;
import com.peoplepay360.repository.EmployeeBankAccountRepository;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.repository.JobOpeningRepository;
import com.peoplepay360.repository.PublicHolidayRepository;
import com.peoplepay360.repository.RoleRepository;
import com.peoplepay360.repository.SalaryStructureRepository;
import com.peoplepay360.repository.TimeOffAllocationRepository;
import com.peoplepay360.repository.TimeOffRequestRepository;
import com.peoplepay360.repository.TimeOffTypeRepository;
import com.peoplepay360.repository.UserPermissionGrantRepository;
import com.peoplepay360.repository.WorkingScheduleRepository;
import com.peoplepay360.model.Attendance;
import com.peoplepay360.model.AttendanceException;
import com.peoplepay360.repository.AttendanceRepository;
import com.peoplepay360.repository.AttendanceExceptionRepository;

/** Seeds a deterministic demo dataset on first startup (demo profile) and on reset. */
@Component
@Profile("demo")
public class DemoSeeder implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(DemoSeeder.class);

    private final AppUserRepository users;
    private final RoleRepository roles;
    private final UserPermissionGrantRepository grants;
    private final DepartmentRepository departments;
    private final EmployeeRepository employees;
    private final EmployeeBankAccountRepository banks;
    private final WorkingScheduleRepository schedules;
    private final ContractRepository contracts;
    private final SalaryStructureRepository structures;
    private final TimeOffTypeRepository types;
    private final TimeOffAllocationRepository allocations;
    private final TimeOffRequestRepository requests;
    private final PublicHolidayRepository holidays;
    private final JobOpeningRepository openings;
    private final CandidateRepository candidates;
    private final CandidateIdentityRepository identities;
    private final PasswordEncoder encoder;
    private final SeedPayrunRunner payrunRunner;
    private final AttendanceRepository attendance;
    private final AttendanceExceptionRepository attendanceExceptions;
    private final ContractTemplateRepository contractTemplates;

    public DemoSeeder(AppUserRepository users, RoleRepository roles, UserPermissionGrantRepository grants,
                      DepartmentRepository departments, EmployeeRepository employees, EmployeeBankAccountRepository banks,
                      WorkingScheduleRepository schedules, ContractRepository contracts,
                      SalaryStructureRepository structures, TimeOffTypeRepository types,
                      TimeOffAllocationRepository allocations, TimeOffRequestRepository requests,
                      PublicHolidayRepository holidays, JobOpeningRepository openings, CandidateRepository candidates,
                      CandidateIdentityRepository identities, PasswordEncoder encoder, SeedPayrunRunner payrunRunner,
                      AttendanceRepository attendance, AttendanceExceptionRepository attendanceExceptions,
                      ContractTemplateRepository contractTemplates) {
        this.users = users;
        this.roles = roles;
        this.grants = grants;
        this.departments = departments;
        this.employees = employees;
        this.banks = banks;
        this.schedules = schedules;
        this.contracts = contracts;
        this.structures = structures;
        this.types = types;
        this.allocations = allocations;
        this.requests = requests;
        this.holidays = holidays;
        this.openings = openings;
        this.candidates = candidates;
        this.identities = identities;
        this.encoder = encoder;
        this.payrunRunner = payrunRunner;
        this.attendance = attendance;
        this.attendanceExceptions = attendanceExceptions;
        this.contractTemplates = contractTemplates;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.count() > 0) {
            log.info("Demo data already present; skipping seed.");
            return;
        }
        log.info("Seeding demo data...");
        seed();
        log.info("Demo data seeded. Log in as admin@peoplepay.local / Admin@12345");
    }

    public void seed() {
        WorkingSchedule schedule = seedSchedule();
        SalaryStructure structure = seedStructure();
        Map<String, Department> depts = seedDepartments();
        seedTypesAndHolidays();
        seedContractTemplates(schedule, structure);

        // Demo role accounts
        List<Object[]> demoAccounts = List.of(
                new Object[]{"admin@peoplepay.local", "Admin@12345", "ADMIN", "Taylor Brooks", true},
                new Object[]{"hr@peoplepay.local", "Hr@12345", "HR_MANAGER", "Morgan Diaz", false},
                new Object[]{"payroll@peoplepay.local", "Payroll@12345", "HR_PAYROLL_USER", "Jordan Lee", false},
                new Object[]{"payroll.manager@peoplepay.local", "Manager@12345", "HR_PAYROLL_MANAGER", "Riley Chen", false},
                new Object[]{"employee@peoplepay.local", "Employee@12345", "EMPLOYEE", "Sam Patel", false});

        Long samEmployeeId = null;
        Long adminUserId = null;
        Long samUserId = null;
        int idx = 0;
        String[] deptNames = {"Operations", "Engineering", "Finance", "Sales"};
        for (Object[] acc : demoAccounts) {
            Department d = depts.get(deptNames[idx % 4]);
            Employee e = newEmployee((String) acc[3], d.getId(), schedule.getId(),
                    ((String) acc[3]).toLowerCase().replace(" ", ".") + "@example.com");
            runningContract(e, structure, schedule, new BigDecimal("50000"), d.getId());
            bank(e);
            AppUser u = newUser((String) acc[0], (String) acc[1], (String) acc[2], (String) acc[3], e.getId(), (boolean) acc[4]);
            e.setUserId(u.getId());
            if ("Taylor Brooks".equals(acc[3])) adminUserId = u.getId();
            if ("Sam Patel".equals(acc[3])) { samEmployeeId = e.getId(); samUserId = u.getId(); }
            idx++;
        }

        // grant chat.access to Sam (employee), granted by admin
        grantChat(samUserId, adminUserId);

        // 35 more employees with real names, department-appropriate job titles, running
        // contracts and bank accounts.
        String[] placeholderNames = {
                "Ethan Walker", "Priya Sharma", "Marcus Bennett", "Aisha Rahman", "Liam Foster",
                "Neha Kapoor", "Oliver Grant", "Fatima Ali", "Noah Reyes", "Zara Khan",
                "Lucas Martin", "Ananya Iyer", "Henry Coleman", "Divya Nair", "Mason Clarke",
                "Sofia Rossi", "Arjun Verma", "Grace Turner", "Ibrahim Siddiqui", "Chloe Anderson",
                "Ravi Krishnan", "Emma Whitfield", "Daniel Osei", "Meera Pillai", "Jack Sullivan",
                "Layla Hassan", "Samuel Okafor", "Isabella Conti", "Rohan Malhotra", "Amara Okonkwo",
                "William Hughes", "Nadia Farouk", "Benjamin Cross", "Kavya Reddy", "Adam Whitlock",
        };
        Map<String, List<String>> titlesByDept = Map.of(
                "Operations", List.of("Operations Analyst", "Warehouse Supervisor", "Logistics Coordinator",
                        "Operations Manager", "Procurement Officer", "Facilities Coordinator",
                        "Quality Control Inspector", "Supply Chain Analyst"),
                "Engineering", List.of("Software Engineer", "QA Engineer", "DevOps Engineer",
                        "Engineering Manager", "Frontend Developer", "Backend Developer",
                        "Site Reliability Engineer", "Data Engineer", "Mobile Developer"),
                "Finance", List.of("Accountant", "Financial Analyst", "Accounts Payable Specialist",
                        "Finance Manager", "Payroll Specialist", "Tax Analyst", "Budget Analyst",
                        "Treasury Analyst", "Bookkeeper"),
                "Sales", List.of("Sales Executive", "Account Manager", "Business Development Rep",
                        "Sales Manager", "Key Account Manager", "Inside Sales Rep",
                        "Regional Sales Manager", "Customer Success Manager", "Sales Operations Analyst"));
        Map<String, Integer> titleIndexByDept = new HashMap<>();

        for (int i = 1; i <= 35; i++) {
            String deptName = deptNames[i % 4];
            Department d = depts.get(deptName);
            String name = placeholderNames[i - 1];
            String email = name.toLowerCase().replace(" ", ".") + "@example.com";
            List<String> titles = titlesByDept.get(deptName);
            int titleIdx = titleIndexByDept.merge(deptName, 1, Integer::sum) - 1;
            String jobTitle = titles.get(titleIdx % titles.size());

            Employee e = newEmployee(name, d.getId(), schedule.getId(), email);
            e.setJobTitle(jobTitle);
            e = employees.save(e);
            LocalDate contractEnd = null;
            if (i == 31) contractEnd = LocalDate.of(2026, 11, 20); // 75 days ahead
            else if (i == 32) contractEnd = LocalDate.of(2026, 12, 15); // 100 days ahead
            else if (i == 33) contractEnd = LocalDate.of(2027, 1, 31); // 147 days ahead
            else if (i == 34) contractEnd = LocalDate.of(2027, 3, 31); // 206 days ahead
            runningContract(e, structure, schedule, new BigDecimal(String.valueOf(40000 + i * 500)), d.getId(), jobTitle, contractEnd);
            if (i != 7) bank(e); // one employee without bank details for the blocker demo
        }

        // Sam's leave scenario
        seedSamLeave(samEmployeeId);

        // Recruitment: Warehouse Supervisor with 3 candidates at OFFER
        seedRecruitment(depts.get("Operations"), structure, schedule);

        // Historical payruns May through August 2026 through the real engine. August is the
        // most recently completed month relative to the demo's "today" of 2026-09-05, so the
        // dashboard's default (last completed month) always lands on populated data.
        for (int month : new int[]{5, 6, 7, 8}) {
            LocalDate start = LocalDate.of(2026, month, 1);
            LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
            payrunRunner.runHistorical(structure.getId(), start, end, adminUserId);
        }

        seedAttendance();
    }

    /**
     * Attendance for every weekday in the last 45 days (excluding the seeded public holiday),
     * so the Attendance module and every dashboard panel that reads it have real data instead
     * of reading zero regardless of which period is selected.
     */
    private void seedAttendance() {
        List<Employee> emps = employees.findAll();
        Random rnd = new Random(20260905L);
        LocalDate holiday = LocalDate.of(2026, 8, 15);
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(45);
        LocalDate to = today.minusDays(1); // never seed "today"; live check-ins own that day

        for (Employee e : emps) {
            for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
                if (d.getDayOfWeek().getValue() > 5) continue; // schedule only has Mon-Fri lines
                if (d.equals(holiday)) continue;

                double roll = rnd.nextDouble();
                Attendance a = new Attendance();
                a.setEmployeeId(e.getId());
                a.setWorkDate(d);
                a.setScheduledMinutes(450); // 09:00-17:00 minus a 30-minute break

                String exceptionType = null;
                int exceptionMinutes = 0;

                if (roll < 0.02) {
                    a.setStatus("ABSENT");
                    a.setWorkedMinutes(0);
                    exceptionType = "ABSENT";
                    exceptionMinutes = 450;
                } else if (roll < 0.05) {
                    OffsetDateTime in = atLocalTime(d, 9, rnd.nextInt(10));
                    a.setCheckIn(in);
                    a.setStatus("MISSING_CHECKOUT");
                    a.setWorkedMinutes(0);
                    exceptionType = "MISSING_CHECKOUT";
                } else if (roll < 0.10) {
                    int lateMinutes = 20 + rnd.nextInt(26); // 20-45 minutes late
                    OffsetDateTime in = atLocalTime(d, 9, lateMinutes);
                    OffsetDateTime out = atLocalTime(d, 17, rnd.nextInt(15));
                    a.setCheckIn(in);
                    a.setCheckOut(out);
                    a.setWorkedMinutes((int) java.time.Duration.between(in, out).toMinutes());
                    a.setStatus("LATE");
                    exceptionType = "LATE";
                    exceptionMinutes = lateMinutes;
                } else if (roll < 0.15) {
                    OffsetDateTime in = atLocalTime(d, 8, 55 + rnd.nextInt(6));
                    OffsetDateTime out = atLocalTime(d, 19, 30 + rnd.nextInt(31));
                    a.setCheckIn(in);
                    a.setCheckOut(out);
                    int worked = (int) java.time.Duration.between(in, out).toMinutes();
                    a.setWorkedMinutes(worked);
                    a.setStatus("OVERTIME");
                    exceptionType = "OVERTIME";
                    exceptionMinutes = Math.max(0, worked - 450);
                } else {
                    OffsetDateTime in = atLocalTime(d, 8, 55 + rnd.nextInt(11));
                    OffsetDateTime out = atLocalTime(d, 17, rnd.nextInt(16));
                    a.setCheckIn(in);
                    a.setCheckOut(out);
                    a.setWorkedMinutes((int) java.time.Duration.between(in, out).toMinutes());
                    a.setStatus("PRESENT");
                    // A few present days were corrected by HR, to populate the manual-edit KPI.
                    if (rnd.nextDouble() < 0.03) {
                        a.setManualEdit(true);
                        a.setEditReason("Adjusted check-out after forgotten badge-out");
                    }
                }
                a = attendance.save(a);

                if (exceptionType != null) {
                    AttendanceException ex = new AttendanceException();
                    ex.setEmployeeId(e.getId());
                    ex.setAttendanceId(a.getId());
                    ex.setDate(d);
                    ex.setType(exceptionType);
                    ex.setMinutes(exceptionMinutes);
                    // Older exceptions have been triaged; the last week is left open for HR to review.
                    ex.setResolved(d.isBefore(today.minusDays(7)));
                    attendanceExceptions.save(ex);
                }
            }
        }
    }

    /** minuteOffset may exceed 59 (jitter arithmetic can overshoot); plusMinutes rolls it over safely. */
    private OffsetDateTime atLocalTime(LocalDate date, int hour, int minuteOffset) {
        return date.atTime(hour, 0).plusMinutes(minuteOffset).atOffset(OffsetDateTime.now().getOffset());
    }

    private WorkingSchedule seedSchedule() {
        WorkingSchedule s = new WorkingSchedule();
        s.setName("Standard 37.5h");
        s.setType("FIXED");
        BigDecimal total = BigDecimal.ZERO;
        for (int day = 1; day <= 5; day++) {
            WorkingScheduleLine l = new WorkingScheduleLine();
            l.setDayOfWeek(day);
            l.setStartTime(LocalTime.of(9, 0));
            l.setEndTime(LocalTime.of(17, 0));
            l.setBreakMinutes(30);
            s.addLine(l);
            total = total.add(new BigDecimal("7.5"));
        }
        s.setWeeklyHours(total);
        return schedules.save(s);
    }

    private SalaryStructure seedStructure() {
        SalaryStructure s = new SalaryStructure();
        s.setName("Standard Monthly");
        s.setCode("STD_MONTHLY");
        s.setActive(true);
        addRule(s, "Basic", "BASIC", "BASIC", 10, "FORMULA", null, null, null, "WAGE");
        addRule(s, "House Rent Allowance", "HRA", "ALLOWANCE", 20, "PERCENTAGE", null, new BigDecimal("20"), "BASIC", null);
        addRule(s, "Transport", "TRANSPORT", "ALLOWANCE", 30, "FIXED", new BigDecimal("1000"), null, null, null);
        addRule(s, "Overtime", "OVERTIME", "ALLOWANCE", 40, "FORMULA", null, null, null, "HOURLY_RATE * 1.5 * OVERTIME_HOURS");
        addRule(s, "Gross", "GROSS", "GROSS", 50, "FORMULA", null, null, null, "C_BASIC + C_ALLOWANCE");
        addRule(s, "Unpaid Deduction", "UNPAID_DED", "DEDUCTION", 60, "FORMULA", null, null, null, "WAGE / SCHEDULED_DAYS * UNPAID_DAYS");
        addRule(s, "Provident Fund", "PF", "DEDUCTION", 70, "PERCENTAGE", null, new BigDecimal("12"), "BASIC", null);
        addRule(s, "Tax", "TAX", "DEDUCTION", 80, "FORMULA", null, null, null, "max(0, (R_GROSS - 25000) * 0.10)");
        addRule(s, "Net", "NET", "NET", 90, "FORMULA", null, null, null, "C_GROSS - C_DEDUCTION");
        return structures.save(s);
    }

    private void addRule(SalaryStructure s, String name, String code, String category, int seq, String type,
                         BigDecimal fixed, BigDecimal pct, String base, String formula) {
        SalaryRule r = new SalaryRule();
        r.setName(name);
        r.setCode(code);
        r.setCategory(category);
        r.setSequence(seq);
        r.setComputeType(type);
        r.setFixedAmount(fixed);
        r.setPercentage(pct);
        r.setBaseRuleCode(base);
        r.setFormula(formula);
        r.setActive(true);
        s.addRule(r); // sets the back-reference the foreign key is mapped to
    }

    private Map<String, Department> seedDepartments() {
        Map<String, Department> map = new LinkedHashMap<>();
        for (String n : new String[]{"Operations", "Engineering", "Finance", "Sales"}) {
            Department d = new Department();
            d.setName(n);
            map.put(n, departments.save(d));
        }
        return map;
    }

    /**
     * Three starting templates, so onboarding somebody is one choice rather than six fields.
     *
     * They are the shapes a small company actually hires in: a salaried permanent role, a fixed-term
     * contract, and a paid intern. Each carries the wage, the schedule and the salary structure, which
     * is everything a running contract needs.
     */
    private void seedContractTemplates(WorkingSchedule schedule, SalaryStructure structure) {
        if (contractTemplates.count() > 0) return;
        record Seed(String name, String jobTitle, String wage, String description) {}
        List<Seed> seeds = List.of(
                new Seed("Permanent — full time", "Team member", "50000",
                        "Standard salaried role on the monthly structure and the standard working week."),
                new Seed("Fixed term — 12 months", "Contractor", "60000",
                        "Same pay rules as a permanent role, with an end date set when the contract is created."),
                new Seed("Intern — paid", "Intern", "18000",
                        "A reduced stipend on the same schedule, for a placement of a few months."));
        for (Seed seed : seeds) {
            ContractTemplate t = new ContractTemplate();
            t.setName(seed.name());
            t.setJobTitle(seed.jobTitle());
            t.setWage(new BigDecimal(seed.wage()));
            t.setWageType("MONTHLY");
            t.setWorkingScheduleId(schedule.getId());
            t.setSalaryStructureId(structure.getId());
            t.setDescription(seed.description());
            t.setActive(true);
            contractTemplates.save(t);
        }
    }

    private void seedTypesAndHolidays() {
        type("Annual Leave", "ANNUAL", true, true, "#34C759");
        type("Sick Leave", "SICK", true, true, "#FF9F0A");
        type("Unpaid Leave", "UNPAID", false, false, "#FF453A");
        holiday(LocalDate.of(2026, 8, 15), "Independence Day");
        holiday(LocalDate.of(2026, 1, 26), "Republic Day");
    }
    private void type(String name, String code, boolean paid, boolean alloc, String color) {
        TimeOffType t = new TimeOffType();
        t.setName(name); t.setCode(code); t.setPaid(paid); t.setRequiresAllocation(alloc); t.setColor(color);
        types.save(t);
    }
    private void holiday(LocalDate d, String name) {
        PublicHoliday h = new PublicHoliday(); h.setDate(d); h.setName(name); holidays.save(h);
    }

    private Employee newEmployee(String name, Long deptId, Long scheduleId, String email) {
        Employee e = new Employee();
        e.setEmployeeNo("E-" + (1000 + employees.count() + 1));
        e.setDisplayName(name);
        e.setWorkEmail(email);
        e.setJobTitle("Staff");
        e.setHireDate(LocalDate.of(2025, 1, 1));
        e.setDepartmentId(deptId);
        e.setEmployeeType("FULL_TIME");
        e.setWorkingScheduleId(scheduleId);
        return employees.save(e);
    }
    private void runningContract(Employee e, SalaryStructure s, WorkingSchedule sch, BigDecimal wage, Long deptId) {
        runningContract(e, s, sch, wage, deptId, "Staff");
    }
    private void runningContract(Employee e, SalaryStructure s, WorkingSchedule sch, BigDecimal wage, Long deptId,
                                 String jobTitle) {
        runningContract(e, s, sch, wage, deptId, jobTitle, null);
    }
    private void runningContract(Employee e, SalaryStructure s, WorkingSchedule sch, BigDecimal wage, Long deptId,
                                 String jobTitle, LocalDate endDate) {
        Contract c = new Contract();
        c.setReference(String.format("C-%04d", contracts.count() + 1));
        c.setEmployeeId(e.getId());
        c.setWage(wage);
        c.setWageType("MONTHLY");
        c.setStartDate(LocalDate.of(2025, 1, 1));
        if (endDate != null) c.setEndDate(endDate);
        c.setState("RUNNING");
        c.setWorkingScheduleId(sch.getId());
        c.setSalaryStructureId(s.getId());
        c.setJobTitle(jobTitle);
        c.setDepartmentId(deptId);
        contracts.save(c);
    }
    private void bank(Employee e) {
        EmployeeBankAccount b = new EmployeeBankAccount();
        b.setEmployeeId(e.getId());
        b.setBankName("Demo Bank");
        b.setAccountNumber("00000000" + (1000 + e.getId()));
        b.setAccountLast4(String.valueOf(1000 + e.getId()).substring(0, 4));
        b.setIfsc("DEMO0001234");
        banks.save(b);
    }
    private AppUser newUser(String email, String password, String roleCode, String name, Long employeeId, boolean breakGlass) {
        Role role = roles.findByCode(roleCode).orElseThrow();
        AppUser u = new AppUser();
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(password));
        u.setDisplayName(name);
        u.setRole(role);
        u.setEmployeeId(employeeId);
        u.setActive(true);
        // A seeded demo account is usable from the first request, not mid-invite.
        u.setPasswordSetAt(java.time.OffsetDateTime.now());
        u.setBreakGlass(breakGlass);
        return users.save(u);
    }
    private void grantChat(Long userId, Long adminId) {
        UserPermissionGrant g = new UserPermissionGrant();
        g.setUserId(userId);
        g.setPermissionCode("chat.access");
        g.setEffect("ALLOW");
        g.setReason("assistant pilot");
        g.setGrantedBy(adminId);
        g.setExpiresAt(OffsetDateTime.now().plusDays(30));
        grants.save(g);
    }

    private void seedSamLeave(Long samId) {
        if (samId == null) return;
        Long annual = types.findByCode("ANNUAL").orElseThrow().getId();
        Long unpaid = types.findByCode("UNPAID").orElseThrow().getId();

        TimeOffAllocation alloc = new TimeOffAllocation();
        alloc.setEmployeeId(samId);
        alloc.setTypeId(annual);
        alloc.setDays(new BigDecimal("10"));
        alloc.setState("DRAFT");
        alloc.setValidFrom(LocalDate.of(2026, 1, 1));
        alloc.setValidTo(LocalDate.of(2026, 12, 31));
        allocations.save(alloc);

        TimeOffRequest annualReq = new TimeOffRequest();
        annualReq.setEmployeeId(samId);
        annualReq.setTypeId(annual);
        annualReq.setStartDate(LocalDate.of(2026, 8, 25));
        annualReq.setEndDate(LocalDate.of(2026, 8, 27));
        annualReq.setDays(new BigDecimal("3"));
        annualReq.setState("NEEDS_ATTENTION");
        annualReq.setAnomaly("Requested 3 days, available 0");
        requests.save(annualReq);

        TimeOffRequest unpaidReq = new TimeOffRequest();
        unpaidReq.setEmployeeId(samId);
        unpaidReq.setTypeId(unpaid);
        unpaidReq.setStartDate(LocalDate.of(2026, 8, 20));
        unpaidReq.setEndDate(LocalDate.of(2026, 8, 21));
        unpaidReq.setDays(new BigDecimal("2"));
        unpaidReq.setState("PENDING");
        requests.save(unpaidReq);
    }

    private void seedRecruitment(Department ops, SalaryStructure structure, WorkingSchedule schedule) {
        JobOpening o = new JobOpening();
        o.setTitle("Warehouse Supervisor");
        o.setDepartmentId(ops.getId());
        o.setSalaryStructureId(structure.getId());
        o.setWorkingScheduleId(schedule.getId());
        o.setBandMin(new BigDecimal("40000"));
        o.setBandMax(new BigDecimal("55000"));
        o.setTargetStartDate(LocalDate.of(2026, 9, 1));
        o.setCriteria("[]");
        o = openings.save(o);
        String[][] profiles = {
                {"C1", "40000", "{\"skills\":[{\"name\":\"Shift lead\",\"level\":4,\"isMustHave\":true}],\"yearsExperience\":4,\"certifications\":[\"Forklift\"],\"noticePeriodDays\":30}"},
                {"C2", "45000", "{\"skills\":[{\"name\":\"Shift lead\",\"level\":5,\"isMustHave\":true}],\"yearsExperience\":6,\"certifications\":[\"Forklift\",\"Safety\"],\"noticePeriodDays\":15}"},
                {"C3", "60000", "{\"skills\":[{\"name\":\"Shift lead\",\"level\":3,\"isMustHave\":true}],\"yearsExperience\":8,\"certifications\":[\"Safety\"],\"noticePeriodDays\":60}"}
        };
        int n = 0;
        for (String[] p : profiles) {
            n++;
            Candidate c = new Candidate();
            c.setOpeningId(o.getId());
            c.setDisplayCode(p[0]);
            c.setExpectedSalary(new BigDecimal(p[1]));
            c.setAvailableFrom(LocalDate.of(2026, 9, 1));
            c.setStage("OFFER");
            c.setProfile(p[2]);
            c = candidates.save(c);
            CandidateIdentity id = new CandidateIdentity();
            id.setCandidateId(c.getId());
            id.setDisplayName("Candidate " + p[0] + " Placeholder");
            id.setEmail(p[0].toLowerCase() + "@example.com");
            id.setPhone("000-000-000" + n);
            identities.save(id);
        }
    }
}
