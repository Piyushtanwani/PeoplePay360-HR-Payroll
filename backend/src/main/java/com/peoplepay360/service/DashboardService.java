package com.peoplepay360.service;

import com.peoplepay360.model.Attendance;
import com.peoplepay360.repository.AttendanceRepository;
import com.peoplepay360.common.Money;
import com.peoplepay360.common.Periods;
import com.peoplepay360.repository.DepartmentRepository;
import com.peoplepay360.model.Employee;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.model.Payrun;
import com.peoplepay360.repository.PayrunRepository;
import com.peoplepay360.model.Payslip;
import com.peoplepay360.repository.PayslipRepository;
import com.peoplepay360.dto.DashboardDtos.*;
import com.peoplepay360.security.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class DashboardService {
    private final PayslipRepository payslips;
    private final PayrunRepository payruns;
    private final EmployeeRepository employees;
    private final DepartmentRepository departments;
    private final AttendanceRepository attendance;
    private final com.peoplepay360.repository.TimeOffTypeRepository timeOffTypes;
    private final com.peoplepay360.repository.TimeOffRequestRepository timeOffRequests;
    private final com.peoplepay360.repository.TimeOffAllocationRepository timeOffAllocations;
    private final com.peoplepay360.repository.AttendanceExceptionRepository exceptions;
    private final com.peoplepay360.repository.AppUserRepository users;
    private final com.peoplepay360.repository.PasswordSetupTokenRepository inviteTokens;
    private final com.peoplepay360.repository.UserPermissionGrantRepository grants;
    private final com.peoplepay360.repository.AuditEventRepository auditEvents;
    private final CurrentUser currentUser;

    public DashboardService(PayslipRepository payslips, PayrunRepository payruns, EmployeeRepository employees,
                            DepartmentRepository departments, AttendanceRepository attendance,
                            com.peoplepay360.repository.TimeOffTypeRepository timeOffTypes,
                            com.peoplepay360.repository.TimeOffRequestRepository timeOffRequests,
                            com.peoplepay360.repository.TimeOffAllocationRepository timeOffAllocations,
                            com.peoplepay360.repository.AttendanceExceptionRepository exceptions,
                            com.peoplepay360.repository.AppUserRepository users,
                            com.peoplepay360.repository.PasswordSetupTokenRepository inviteTokens,
                            com.peoplepay360.repository.UserPermissionGrantRepository grants,
                            com.peoplepay360.repository.AuditEventRepository auditEvents,
                            CurrentUser currentUser) {
        this.exceptions = exceptions;
        this.users = users;
        this.inviteTokens = inviteTokens;
        this.grants = grants;
        this.auditEvents = auditEvents;
        this.payslips = payslips;
        this.payruns = payruns;
        this.employees = employees;
        this.departments = departments;
        this.attendance = attendance;
        this.timeOffTypes = timeOffTypes;
        this.timeOffRequests = timeOffRequests;
        this.timeOffAllocations = timeOffAllocations;
        this.currentUser = currentUser;
    }

    /**
     * Per leave type: days approved whose leave falls in the period, requests still pending,
     * and the balance left (approved allocations minus approved days) for types that need one.
     */
    private List<TimeOffRow> timeOffOverview(LocalDate from, LocalDate to) {
        var requests = timeOffRequests.findAll();
        var allocations = timeOffAllocations.findAll();
        List<TimeOffRow> rows = new ArrayList<>();
        for (var type : timeOffTypes.findAll()) {
            if (!type.isActive()) continue;
            BigDecimal approvedInPeriod = requests.stream()
                    .filter(r -> r.getTypeId().equals(type.getId()))
                    .filter(r -> "APPROVED".equals(r.getState()))
                    .filter(r -> !r.getStartDate().isAfter(to) && !r.getEndDate().isBefore(from))
                    .map(r -> r.getDays() == null ? BigDecimal.ZERO : r.getDays())
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            long pending = requests.stream()
                    .filter(r -> r.getTypeId().equals(type.getId()))
                    .filter(r -> "PENDING".equals(r.getState()))
                    .count();
            BigDecimal remaining = null;
            if (type.isRequiresAllocation()) {
                BigDecimal allocated = allocations.stream()
                        .filter(a -> a.getTypeId().equals(type.getId()))
                        .filter(a -> "APPROVED".equals(a.getState()))
                        .map(a -> a.getDays() == null ? BigDecimal.ZERO : a.getDays())
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal takenAllTime = requests.stream()
                        .filter(r -> r.getTypeId().equals(type.getId()))
                        .filter(r -> "APPROVED".equals(r.getState()))
                        .map(r -> r.getDays() == null ? BigDecimal.ZERO : r.getDays())
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                remaining = Money.scale(allocated.subtract(takenAllTime));
            }
            rows.add(new TimeOffRow(type.getName(), Money.scale(approvedInPeriod), pending, remaining,
                    type.isRequiresAllocation()));
        }
        rows.sort(Comparator.comparing(TimeOffRow::typeName));
        return rows;
    }

    @PreAuthorize("hasAuthority('dashboard.read.hr')")
    @Transactional(readOnly = true)
    public Dashboard build(String period, Long departmentId, String employeeType) {
        boolean payroll = currentUser.hasAuthority("dashboard.read.payroll");
        LocalDate[] range = Periods.month(period);
        Map<Long, String> deptNames = new HashMap<>();
        departments.findAll().forEach(d -> deptNames.put(d.getId(), d.getName()));

        List<Employee> emps = employees.findAll().stream()
                .filter(Employee::isActive)
                .filter(e -> departmentId == null || departmentId.equals(e.getDepartmentId()))
                .filter(e -> employeeType == null || employeeType.equals(e.getEmployeeType()))
                .toList();
        Set<Long> empIds = new HashSet<>();
        emps.forEach(e -> empIds.add(e.getId()));

        // Six months of payslips, read once. The trend below used to re-scan the whole table per month
        // and look up each payslip's payrun individually.
        LocalDate trendStart = range[0].minusMonths(5).withDayOfMonth(1);
        List<Payslip> window = payslips.findInRange(trendStart, range[1]);
        Map<Long, String> payrunStates = new HashMap<>();
        payruns.findAllById(window.stream().map(Payslip::getPayrunId).collect(java.util.stream.Collectors.toSet()))
                .forEach(r -> payrunStates.put(r.getId(), r.getState()));
        java.util.function.Predicate<Payslip> settled = p -> {
            String st = payrunStates.getOrDefault(p.getPayrunId(), "");
            return st.equals("PAID") || st.equals("SENT");
        };

        List<Payslip> periodSlips = window.stream()
                .filter(p -> empIds.contains(p.getEmployeeId()))
                .filter(p -> !p.getPeriodStart().isAfter(range[1]) && !p.getPeriodEnd().isBefore(range[0]))
                .filter(settled).toList();

        BigDecimal totalNet = periodSlips.stream().map(Payslip::getNet).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal avg = periodSlips.isEmpty() ? BigDecimal.ZERO :
                totalNet.divide(BigDecimal.valueOf(periodSlips.size()), 2, RoundingMode.HALF_UP);

        // attendance overview
        List<Attendance> att = attendance.findAllInRange(range[0], range[1]).stream()
                .filter(a -> empIds.contains(a.getEmployeeId())).toList();
        long present = att.stream().filter(a -> "PRESENT".equals(a.getStatus())).count();
        long late = att.stream().filter(a -> "LATE".equals(a.getStatus())).count();
        long absent = att.stream().filter(a -> "ABSENT".equals(a.getStatus())).count();
        long overtime = att.stream().filter(a -> "OVERTIME".equals(a.getStatus())).count();
        long missing = att.stream().filter(a -> "MISSING_CHECKOUT".equals(a.getStatus())).count();
        long manual = att.stream().filter(Attendance::isManualEdit).count();
        long worked = present + overtime + late;
        BigDecimal coverage = att.isEmpty() ? BigDecimal.ZERO :
                BigDecimal.valueOf(worked * 100.0 / att.size()).setScale(1, RoundingMode.HALF_UP);
        AttendanceOverview overview = new AttendanceOverview(present, late, absent, overtime, missing, manual, coverage);

        // department rows
        Map<Long, Long> headcount = new HashMap<>();
        for (Employee e : emps) headcount.merge(e.getDepartmentId(), 1L, Long::sum);
        Map<Long, Long> departmentOfEmployee = new HashMap<>();
        emps.forEach(e -> departmentOfEmployee.put(e.getId(), e.getDepartmentId()));
        Map<Long, BigDecimal> spend = new HashMap<>();
        for (Payslip p : periodSlips) {
            spend.merge(departmentOfEmployee.get(p.getEmployeeId()), p.getNet(), BigDecimal::add);
        }
        List<DepartmentRow> deptRows = new ArrayList<>();
        List<NamedAmount> costByDept = new ArrayList<>();
        for (Map.Entry<Long, Long> en : headcount.entrySet()) {
            String name = deptNames.getOrDefault(en.getKey(), "Unassigned");
            BigDecimal s = payroll ? Money.scale(spend.getOrDefault(en.getKey(), BigDecimal.ZERO)) : null;
            deptRows.add(new DepartmentRow(name, en.getValue(), s));
            if (payroll) costByDept.add(new NamedAmount(name, Money.scale(spend.getOrDefault(en.getKey(), BigDecimal.ZERO))));
        }

        // monthly trend (six months) — payroll only
        List<MonthAmount> trend = null;
        if (payroll) {
            trend = new ArrayList<>();
            LocalDate cursor = range[0];
            for (int i = 5; i >= 0; i--) {
                LocalDate m = cursor.minusMonths(i);
                String key = String.format("%04d-%02d", m.getYear(), m.getMonthValue());
                LocalDate[] mr = Periods.month(key);
                BigDecimal sum = window.stream()
                        .filter(p -> !p.getPeriodStart().isAfter(mr[1]) && !p.getPeriodEnd().isBefore(mr[0]))
                        .filter(settled)
                        .map(Payslip::getNet).reduce(BigDecimal.ZERO, BigDecimal::add);
                trend.add(new MonthAmount(key, Money.scale(sum)));
            }
        }

        // Alerts point at the screen that fixes them, so a figure is never a dead end.
        List<Alert> alerts = new ArrayList<>();
        if (missing > 0) {
            alerts.add(new Alert("WARNING", "HR", missing + " attendance entries have no check-out.",
                    "/attendance?tab=exceptions&type=MISSING_CHECKOUT&period=" + period));
        }
        if (absent > 0) {
            alerts.add(new Alert("WARNING", "HR", absent + " unexplained absences in the period.",
                    "/attendance?tab=exceptions&type=ABSENT&period=" + period));
        }
        long openExceptions = exceptions.findAll().stream()
                .filter(x -> !x.isResolved() && !x.getDate().isBefore(range[0]) && !x.getDate().isAfter(range[1]))
                .count();
        long pendingApprovals = timeOffRequests.findAll().stream()
                .filter(r -> "PENDING".equals(r.getState()) || "NEEDS_ATTENTION".equals(r.getState()))
                .count();
        if (pendingApprovals > 0) {
            alerts.add(new Alert("WARNING", "HR", pendingApprovals + " leave requests await a decision.",
                    "/timeoff?tab=requests&state=PENDING"));
        }
        if (payroll) {
            payruns.findAll().stream()
                    .filter(r -> "COMPUTED".equals(r.getState()) || "VALIDATED".equals(r.getState()))
                    .forEach(r -> alerts.add(new Alert("WARNING", "PAYROLL",
                            r.getName() + " is " + r.getState().toLowerCase() + " and not yet paid.",
                            "/payroll/payruns/" + r.getId())));
        }

        AdminBlock adminBlock = null;
        if (currentUser.hasAuthority("user.read")) {
            OffsetDateTime now = OffsetDateTime.now();
            adminBlock = new AdminBlock(
                    users.countByActiveTrue(),
                    inviteTokens.countByPurposeAndUsedAtIsNullAndExpiresAtAfter("INVITE", now),
                    grants.countByRevokedAtIsNullAndExpiresAtBetween(now, now.plusDays(7)),
                    auditEvents.countByOutcomeAndOccurredAtAfter("DENY", now.minusDays(1)));
        }

        List<TimeOffRow> timeOff = timeOffOverview(range[0], range[1]);
        BigDecimal approvedDays = timeOff.stream()
                .map(TimeOffRow::approvedDays)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Kpis kpis = new Kpis(
                payroll ? Money.scale(totalNet) : null,
                payroll ? periodSlips.size() : null,
                payroll ? avg : null,
                approvedDays,
                coverage);

        return new Dashboard(period, new Filters(departmentId, employeeType), kpis,
                payroll ? costByDept : null, trend, alerts, overview, timeOff, deptRows,
                adminBlock, emps.size(), pendingApprovals, openExceptions);
    }
}
