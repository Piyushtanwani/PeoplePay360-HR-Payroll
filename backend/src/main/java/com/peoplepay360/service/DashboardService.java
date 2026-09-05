package com.peoplepay360.service;

import com.peoplepay360.model.Attendance;
import com.peoplepay360.repository.AttendanceRepository;
import com.peoplepay360.common.Money;
import com.peoplepay360.common.Periods;
import com.peoplepay360.model.Department;
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
    private final CurrentUser currentUser;

    public DashboardService(PayslipRepository payslips, PayrunRepository payruns, EmployeeRepository employees,
                            DepartmentRepository departments, AttendanceRepository attendance,
                            com.peoplepay360.repository.TimeOffTypeRepository timeOffTypes,
                            com.peoplepay360.repository.TimeOffRequestRepository timeOffRequests,
                            com.peoplepay360.repository.TimeOffAllocationRepository timeOffAllocations,
                            CurrentUser currentUser) {
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

        // payslips in paid/sent payruns intersecting the period
        List<Payslip> periodSlips = payslips.findAll().stream()
                .filter(p -> empIds.contains(p.getEmployeeId()))
                .filter(p -> !p.getPeriodStart().isAfter(range[1]) && !p.getPeriodEnd().isBefore(range[0]))
                .filter(p -> {
                    String st = payruns.findById(p.getPayrunId()).map(Payrun::getState).orElse("");
                    return st.equals("PAID") || st.equals("SENT");
                }).toList();

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
        Map<Long, BigDecimal> spend = new HashMap<>();
        for (Payslip p : periodSlips) {
            Long dept = employees.findById(p.getEmployeeId()).map(Employee::getDepartmentId).orElse(null);
            spend.merge(dept, p.getNet(), BigDecimal::add);
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
                BigDecimal sum = payslips.findAll().stream()
                        .filter(p -> !p.getPeriodStart().isAfter(mr[1]) && !p.getPeriodEnd().isBefore(mr[0]))
                        .filter(p -> {
                            String st = payruns.findById(p.getPayrunId()).map(Payrun::getState).orElse("");
                            return st.equals("PAID") || st.equals("SENT");
                        })
                        .map(Payslip::getNet).reduce(BigDecimal.ZERO, BigDecimal::add);
                trend.add(new MonthAmount(key, Money.scale(sum)));
            }
        }

        // alerts
        List<Alert> alerts = new ArrayList<>();
        if (missing > 0) alerts.add(new Alert("WARNING", "HR", missing + " missing check-outs in the period.",
                "/attendance/exceptions?type=MISSING_CHECKOUT"));

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
                payroll ? costByDept : null, trend, alerts, overview, timeOff, deptRows);
    }
}
