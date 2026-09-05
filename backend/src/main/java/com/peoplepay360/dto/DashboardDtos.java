package com.peoplepay360.dto;

import java.math.BigDecimal;
import java.util.List;

public class DashboardDtos {
    public record Kpis(BigDecimal totalNetPaid, Integer payslipsGenerated, BigDecimal averageSalary,
                       BigDecimal approvedTimeOffDays, BigDecimal attendanceHealthPct) {}
    public record NamedAmount(String departmentName, BigDecimal amount) {}
    public record MonthAmount(String month, BigDecimal amount) {}
    public record Alert(String severity, String kind, String message, String link) {}
    public record AttendanceOverview(long present, long late, long absent, long overtime, long missingCheckouts,
                                     long manualEdits, BigDecimal coveragePct) {}
    public record DepartmentRow(String departmentName, long headcount, BigDecimal salarySpend) {}
    /** One leave type: days approved in the period, requests still awaiting a decision, balance left. */
    public record TimeOffRow(String typeName, BigDecimal approvedDays, long pending, BigDecimal remainingBalance,
                             boolean requiresAllocation) {}
    public record Filters(Long departmentId, String employeeType) {}
    public record Dashboard(String period, Filters filters, Kpis kpis, List<NamedAmount> salaryCostByDepartment,
                            List<MonthAmount> monthlyNetTrend, List<Alert> alerts, AttendanceOverview attendanceOverview,
                            List<TimeOffRow> timeOffOverview, List<DepartmentRow> departments) {}
}
