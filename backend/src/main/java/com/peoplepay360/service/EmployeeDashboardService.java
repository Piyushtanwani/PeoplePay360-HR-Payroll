package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.Periods;
import com.peoplepay360.config.AppProperties;
import com.peoplepay360.dto.AttendanceDtos.AttendanceDto;
import com.peoplepay360.dto.DashboardDtos.MyContract;
import com.peoplepay360.dto.DashboardDtos.MyDashboard;
import com.peoplepay360.dto.DashboardDtos.MyPayslip;
import com.peoplepay360.dto.TimeOffDtos.HolidayDto;
import com.peoplepay360.dto.TimeOffDtos.LeaveBalance;
import com.peoplepay360.dto.TimeOffDtos.RequestDto;
import com.peoplepay360.model.Attendance;
import com.peoplepay360.model.Contract;
import com.peoplepay360.model.Department;
import com.peoplepay360.model.Employee;
import com.peoplepay360.model.Payrun;
import com.peoplepay360.model.Payslip;
import com.peoplepay360.model.TimeOffRequest;
import com.peoplepay360.model.TimeOffType;
import com.peoplepay360.model.WorkingSchedule;
import com.peoplepay360.repository.*;
import com.peoplepay360.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;

/**
 * The employee's own home screen.
 *
 * <p>Employees hold no dashboard permission at all, so the HR dashboard is a hard denial for them and
 * they previously landed on the attendance page instead. This assembles what they can actually see:
 * their own attendance, leave, payslips and contract, each block gated on the matching .own permission
 * so the page shows what they have rather than empty frames.
 */
@Service
public class EmployeeDashboardService {
    private final EmployeeRepository employees;
    private final DepartmentRepository departments;
    private final AttendanceRepository attendance;
    private final AttendanceExceptionRepository exceptions;
    private final TimeOffRequestRepository requests;
    private final TimeOffTypeRepository types;
    private final PublicHolidayRepository holidays;
    private final PayslipRepository payslips;
    private final PayrunRepository payruns;
    private final ContractRepository contracts;
    private final WorkingScheduleRepository schedules;
    private final LeaveBalanceService balanceService;
    private final CurrentUser currentUser;
    private final AppProperties props;

    public EmployeeDashboardService(EmployeeRepository employees, DepartmentRepository departments,
                                    AttendanceRepository attendance, AttendanceExceptionRepository exceptions,
                                    TimeOffRequestRepository requests, TimeOffTypeRepository types,
                                    PublicHolidayRepository holidays, PayslipRepository payslips,
                                    PayrunRepository payruns, ContractRepository contracts,
                                    WorkingScheduleRepository schedules, LeaveBalanceService balanceService,
                                    CurrentUser currentUser, AppProperties props) {
        this.employees = employees;
        this.departments = departments;
        this.attendance = attendance;
        this.exceptions = exceptions;
        this.requests = requests;
        this.types = types;
        this.holidays = holidays;
        this.payslips = payslips;
        this.payruns = payruns;
        this.contracts = contracts;
        this.schedules = schedules;
        this.balanceService = balanceService;
        this.currentUser = currentUser;
        this.props = props;
    }

    @Transactional(readOnly = true)
    public MyDashboard build() {
        Long employeeId = currentUser.employeeId();
        if (employeeId == null) {
            throw ApiException.illegalState(
                    "Your account is not linked to an employee record, so there is nothing to show here yet.");
        }
        Employee e = employees.findById(employeeId).orElseThrow(() -> ApiException.notFound("employee"));
        String departmentName = e.getDepartmentId() == null ? null
                : departments.findById(e.getDepartmentId()).map(Department::getName).orElse(null);

        ZoneId zone = ZoneId.of(props.getTimezone());
        LocalDate today = LocalDate.now(zone);
        LocalDate[] month = Periods.month(YearMonth.from(today).toString());

        AttendanceDto open = null;
        List<AttendanceDto> todayRows = List.of();
        long attendanceDays = 0;
        long openExceptions = 0;
        if (currentUser.hasAuthority("attendance.read.own")) {
            open = attendance.findByEmployeeIdAndCheckOutIsNull(employeeId).map(this::toAttendance).orElse(null);
            todayRows = attendance.findByEmployeeIdAndWorkDate(employeeId, today).stream()
                    .map(this::toAttendance).toList();
            attendanceDays = attendance.findRange(employeeId, month[0], month[1]).stream()
                    .filter(a -> a.getCheckOut() != null).count();
            openExceptions = exceptions.findAll().stream()
                    .filter(x -> x.getEmployeeId().equals(employeeId) && !x.isResolved())
                    .filter(x -> !x.getDate().isBefore(month[0]) && !x.getDate().isAfter(month[1]))
                    .count();
        }

        List<LeaveBalance> balances = currentUser.hasAuthority("timeoff_allocation.read.own")
                ? balanceService.balances(employeeId)
                : List.of();

        List<RequestDto> pending = List.of();
        if (currentUser.hasAuthority("timeoff_request.read.own")) {
            pending = requests.findByEmployeeIdAndState(employeeId, "PENDING").stream()
                    .map(this::toRequest)
                    .toList();
            List<RequestDto> attention = requests.findByEmployeeIdAndState(employeeId, "NEEDS_ATTENTION").stream()
                    .map(this::toRequest)
                    .toList();
            pending = java.util.stream.Stream.concat(pending.stream(), attention.stream())
                    .sorted(java.util.Comparator.comparing(RequestDto::startDate))
                    .toList();
        }

        List<MyPayslip> recent = List.of();
        if (currentUser.hasAuthority("payslip.read.own")) {
            recent = payslips.findTop3ByEmployeeIdOrderByPeriodEndDesc(employeeId).stream()
                    .map(p -> new MyPayslip(p.getId(), p.getPeriodStart(), p.getPeriodEnd(), p.getNet(),
                            payruns.findById(p.getPayrunId()).map(Payrun::getState).orElse(null)))
                    .toList();
        }

        List<HolidayDto> upcoming = holidays.findTop3ByDateGreaterThanEqualOrderByDateAsc(today).stream()
                .map(h -> new HolidayDto(h.getId(), h.getDate(), h.getName()))
                .toList();

        MyContract contract = null;
        if (currentUser.hasAuthority("contract.read.own")) {
            contract = contracts.findByEmployeeIdAndStateIn(employeeId, List.of("RUNNING")).stream()
                    .filter(c -> c.containsDate(today))
                    .findFirst()
                    .map(this::toContract)
                    .orElse(null);
        }

        return new MyDashboard(e.getDisplayName(), e.getEmployeeNo(), e.getJobTitle(), departmentName,
                open, todayRows, attendanceDays, openExceptions, balances, pending, recent, upcoming, contract);
    }

    private AttendanceDto toAttendance(Attendance a) {
        return new AttendanceDto(a.getId(), a.getEmployeeId(), null, a.getWorkDate(), a.getCheckIn(),
                a.getCheckOut(), a.getWorkedMinutes(), a.getScheduledMinutes(), a.getStatus(),
                a.isManualEdit(), a.getEditedBy(), a.getEditReason());
    }

    private RequestDto toRequest(TimeOffRequest r) {
        String typeName = types.findById(r.getTypeId()).map(TimeOffType::getName).orElse(null);
        return new RequestDto(r.getId(), r.getEmployeeId(), null, r.getTypeId(), typeName,
                r.getStartDate(), r.getEndDate(), r.getDays(), r.getState(), r.getReason(),
                r.getAnomaly(), r.getDecidedBy(), r.getDecidedAt(), r.getDecisionNote());
    }

    /** Wage is deliberately omitted: the figure belongs on the contract page, behind its own permission. */
    private MyContract toContract(Contract c) {
        String scheduleName = c.getWorkingScheduleId() == null ? null
                : schedules.findById(c.getWorkingScheduleId()).map(WorkingSchedule::getName).orElse(null);
        return new MyContract(c.getId(), c.getReference(), c.getJobTitle(), c.getWageType(),
                c.getStartDate(), c.getEndDate(), c.derivedState(LocalDate.now()), scheduleName);
    }
}
