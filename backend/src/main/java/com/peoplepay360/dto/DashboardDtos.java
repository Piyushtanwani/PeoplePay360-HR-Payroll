package com.peoplepay360.dto;

import com.peoplepay360.dto.AttendanceDtos.AttendanceDto;
import com.peoplepay360.dto.TimeOffDtos.HolidayDto;
import com.peoplepay360.dto.TimeOffDtos.LeaveBalance;
import com.peoplepay360.dto.TimeOffDtos.RequestDto;

import java.math.BigDecimal;
import java.time.LocalDate;
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

    /**
     * The operational tiles an administrator needs and nobody else does. Present only when the caller
     * holds user.read, so the payload itself reflects what the caller may see.
     */
    public record AdminBlock(long activeUsers, long pendingInvites, long grantsExpiringIn7Days,
                             long deniedActionsLast24h) {}

    public record Dashboard(String period, Filters filters, Kpis kpis, List<NamedAmount> salaryCostByDepartment,
                            List<MonthAmount> monthlyNetTrend, List<Alert> alerts, AttendanceOverview attendanceOverview,
                            List<TimeOffRow> timeOffOverview, List<DepartmentRow> departments,
                            AdminBlock admin, long headcount, long pendingApprovals, long openExceptions) {}

    // ---- employee home -----------------------------------------------------
    /** The contract that drives the caller's pay. Wage is deliberately absent from the summary. */
    public record MyContract(Long id, String reference, String jobTitle, String wageType,
                             LocalDate startDate, LocalDate endDate, String state, String scheduleName) {}
    public record MyPayslip(Long id, LocalDate periodStart, LocalDate periodEnd, BigDecimal net, String payrunState) {}
    /**
     * An employee's own home screen. Every block is null when the caller lacks the matching .own
     * permission, so the page renders what they actually have rather than empty frames.
     */
    public record MyDashboard(String displayName, String employeeNo, String jobTitle, String departmentName,
                              AttendanceDto openAttendance, List<AttendanceDto> todayAttendance,
                              long attendanceDaysThisMonth, long exceptionsThisMonth,
                              List<LeaveBalance> leaveBalances, List<RequestDto> pendingRequests,
                              List<MyPayslip> recentPayslips, List<HolidayDto> upcomingHolidays,
                              MyContract contract) {}
}
