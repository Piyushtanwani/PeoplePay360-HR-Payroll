package com.peoplepay360.timeoff;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.common.Money;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.employee.Employee;
import com.peoplepay360.employee.EmployeeRepository;
import com.peoplepay360.schedule.ScheduleService;
import com.peoplepay360.schedule.WorkingSchedule;
import com.peoplepay360.schedule.WorkingScheduleRepository;
import com.peoplepay360.security.CurrentUser;
import com.peoplepay360.security.ScopeResolver;
import com.peoplepay360.security.SelfActionGuard;
import com.peoplepay360.timeoff.TimeOffDtos.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class TimeOffService {
    private final TimeOffTypeRepository types;
    private final TimeOffAllocationRepository allocations;
    private final TimeOffRequestRepository requests;
    private final PublicHolidayRepository holidays;
    private final EmployeeRepository employees;
    private final WorkingScheduleRepository schedules;
    private final ScheduleService scheduleService;
    private final LeaveBalanceService balanceService;
    private final CurrentUser currentUser;
    private final ScopeResolver scopeResolver;
    private final SelfActionGuard selfActionGuard;
    private final AuditService audit;

    public TimeOffService(TimeOffTypeRepository types, TimeOffAllocationRepository allocations,
                          TimeOffRequestRepository requests, PublicHolidayRepository holidays,
                          EmployeeRepository employees, WorkingScheduleRepository schedules,
                          ScheduleService scheduleService, LeaveBalanceService balanceService,
                          CurrentUser currentUser, ScopeResolver scopeResolver, SelfActionGuard selfActionGuard,
                          AuditService audit) {
        this.types = types;
        this.allocations = allocations;
        this.requests = requests;
        this.holidays = holidays;
        this.employees = employees;
        this.schedules = schedules;
        this.scheduleService = scheduleService;
        this.balanceService = balanceService;
        this.currentUser = currentUser;
        this.scopeResolver = scopeResolver;
        this.selfActionGuard = selfActionGuard;
        this.audit = audit;
    }

    // ---------- types ----------
    @PreAuthorize("hasAuthority('timeoff_type.read')")
    @Transactional(readOnly = true)
    public List<TypeDto> listTypes() { return types.findAll().stream().map(this::toType).toList(); }

    @PreAuthorize("hasAuthority('timeoff_type.manage')")
    @Transactional
    public TypeDto saveType(Long id, SaveType in) {
        TimeOffType t = id == null ? new TimeOffType() : types.findById(id).orElseThrow(() -> ApiException.notFound("type"));
        if (in.name() != null) t.setName(in.name());
        if (in.code() != null) t.setCode(in.code());
        if (in.isPaid() != null) t.setPaid(in.isPaid());
        if (in.requiresAllocation() != null) t.setRequiresAllocation(in.requiresAllocation());
        if (in.color() != null) t.setColor(in.color());
        if (in.active() != null) t.setActive(in.active());
        return toType(types.save(t));
    }

    // ---------- balances ----------
    @PreAuthorize("hasAuthority('timeoff_allocation.read.own')")
    @Transactional(readOnly = true)
    public List<LeaveBalance> balances(Long employeeId) {
        Long scoped = scopeResolver.resolveEmployeeFilter("timeoff_allocation.read.all", employeeId);
        Long emp = scoped != null ? scoped : requireEmployee();
        return balanceService.balances(emp);
    }

    // ---------- allocations ----------
    @PreAuthorize("hasAuthority('timeoff_allocation.read.own')")
    @Transactional(readOnly = true)
    public List<AllocationDto> listAllocations(Long employeeId, String state) {
        Long scoped = scopeResolver.resolveEmployeeFilter("timeoff_allocation.read.all", employeeId);
        return allocations.findAll().stream()
                .filter(a -> scoped == null || a.getEmployeeId().equals(scoped))
                .filter(a -> state == null || a.getState().equals(state))
                .map(this::toAllocation).toList();
    }

    @PreAuthorize("hasAuthority('timeoff_allocation.create.all')")
    @Transactional
    public AllocationDto createAllocation(CreateAllocation in) {
        TimeOffAllocation a = new TimeOffAllocation();
        a.setEmployeeId(in.employeeId());
        a.setTypeId(in.typeId());
        a.setDays(in.days());
        a.setValidFrom(in.validFrom());
        a.setValidTo(in.validTo());
        a.setNote(in.note());
        a.setState("DRAFT");
        return toAllocation(allocations.save(a));
    }

    @PreAuthorize("hasAuthority('timeoff_allocation.approve')")
    @Transactional
    public AllocationDto decideAllocation(Long id, boolean approve, Decision in) {
        TimeOffAllocation a = allocations.findById(id).orElseThrow(() -> ApiException.notFound("allocation"));
        selfActionGuard.assertNotSelf(a.getEmployeeId(), "APPROVE_ALLOCATION", "timeoff_allocation");
        a.setState(approve ? "APPROVED" : "REFUSED");
        a.setApprovedBy(currentUser.userId());
        a.setApprovedAt(OffsetDateTime.now());
        if (approve) reEvaluateNeedsAttention(a.getEmployeeId(), a.getTypeId());
        audit.record(Channel.UI, approve ? "APPROVE_ALLOCATION" : "REFUSE_ALLOCATION",
                "timeoff_allocation", id.toString(), "ALLOW", null, null, null);
        return toAllocation(a);
    }

    // ---------- requests ----------
    @PreAuthorize("hasAuthority('timeoff_request.read.own')")
    @Transactional(readOnly = true)
    public List<RequestDto> listRequests(Long employeeId, String state) {
        Long scoped = scopeResolver.resolveEmployeeFilter("timeoff_request.read.all", employeeId);
        return requests.findAll().stream()
                .filter(r -> scoped == null || r.getEmployeeId().equals(scoped))
                .filter(r -> state == null || r.getState().equals(state))
                .map(this::toRequest).toList();
    }

    @PreAuthorize("hasAuthority('timeoff_request.read.own')")
    @Transactional(readOnly = true)
    public RequestDto getRequest(Long id) {
        TimeOffRequest r = requests.findById(id).orElseThrow(() -> ApiException.notFound("request"));
        if (!currentUser.hasAuthority("timeoff_request.read.all") &&
                !r.getEmployeeId().equals(currentUser.employeeId())) {
            throw ApiException.notFound("request");
        }
        return toRequest(r);
    }

    @PreAuthorize("hasAuthority('timeoff_request.create.own')")
    @Transactional
    public RequestDto createRequest(CreateRequest in) {
        Long emp = in.employeeId();
        if (emp == null) emp = requireEmployee();
        else if (!currentUser.hasAuthority("timeoff_request.create.all") && !emp.equals(currentUser.employeeId())) {
            throw new com.peoplepay360.common.PermissionDeniedException("timeoff_request.create.all");
        }
        TimeOffType type = types.findById(in.typeId()).orElseThrow(() -> ApiException.validation("Unknown type"));
        BigDecimal days = computeDays(emp, in.startDate(), in.endDate());
        TimeOffRequest r = new TimeOffRequest();
        r.setEmployeeId(emp);
        r.setTypeId(in.typeId());
        r.setStartDate(in.startDate());
        r.setEndDate(in.endDate());
        r.setDays(days);
        r.setReason(in.reason());
        if (type.isRequiresAllocation()) {
            BigDecimal available = balanceService.balance(emp, type).available();
            if (available.compareTo(days) < 0) {
                r.setState("NEEDS_ATTENTION");
                r.setAnomaly("Requested " + days + " days, available " + available);
            } else {
                r.setState("PENDING");
            }
        } else {
            r.setState("PENDING");
        }
        return toRequest(requests.save(r));
    }

    @PreAuthorize("hasAuthority('timeoff_request.create.own')")
    @Transactional(readOnly = true)
    public SimulateResult simulate(SimulateRequest in) {
        Long emp = in.employeeId() != null ? in.employeeId() : requireEmployee();
        TimeOffType type = types.findById(in.typeId()).orElseThrow(() -> ApiException.validation("Unknown type"));
        BigDecimal days = computeDays(emp, in.startDate(), in.endDate());
        BigDecimal available = type.isRequiresAllocation() ? balanceService.balance(emp, type).available() : days;
        BigDecimal after = available.subtract(days);
        String anomaly = (type.isRequiresAllocation() && available.compareTo(days) < 0)
                ? "Requested " + days + " days, available " + available : null;
        return new SimulateResult(days, Money.scale(available), Money.scale(after), anomaly);
    }

    @PreAuthorize("hasAuthority('timeoff_request.approve')")
    @Transactional
    public RequestDto decideRequest(Long id, boolean approve, Decision in) {
        TimeOffRequest r = requests.findById(id).orElseThrow(() -> ApiException.notFound("request"));
        selfActionGuard.assertNotSelf(r.getEmployeeId(), "APPROVE_REQUEST", "timeoff_request");
        if (approve) {
            TimeOffType type = types.findById(r.getTypeId()).orElseThrow();
            if (type.isRequiresAllocation()) {
                BigDecimal available = balanceService.balance(r.getEmployeeId(), type).available();
                boolean force = in != null && Boolean.TRUE.equals(in.force());
                if (available.compareTo(r.getDays()) < 0 && !force) {
                    throw new ApiException(ErrorCode.ILLEGAL_STATE,
                            "Insufficient balance. Approve with force to override.");
                }
            }
            r.setState("APPROVED");
        } else {
            r.setState("REFUSED");
        }
        r.setDecidedBy(currentUser.userId());
        r.setDecidedAt(OffsetDateTime.now());
        if (in != null) r.setDecisionNote(in.note());
        audit.record(Channel.UI, approve ? "APPROVE_REQUEST" : "REFUSE_REQUEST",
                "timeoff_request", id.toString(), "ALLOW", in == null ? null : in.note(), null, null);
        return toRequest(r);
    }

    @PreAuthorize("hasAuthority('timeoff_request.update.own')")
    @Transactional
    public RequestDto cancel(Long id) {
        TimeOffRequest r = requests.findById(id).orElseThrow(() -> ApiException.notFound("request"));
        if (!currentUser.hasAuthority("timeoff_request.update.all") &&
                !r.getEmployeeId().equals(currentUser.employeeId())) {
            throw ApiException.notFound("request");
        }
        r.setState("CANCELLED");
        return toRequest(r);
    }

    // ---------- holidays ----------
    @PreAuthorize("hasAuthority('timeoff_type.read')")
    @Transactional(readOnly = true)
    public List<HolidayDto> holidays(int year) {
        return holidays.findByDateBetween(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31))
                .stream().map(h -> new HolidayDto(h.getId(), h.getDate(), h.getName())).toList();
    }

    // ---------- helpers ----------
    private void reEvaluateNeedsAttention(Long employeeId, Long typeId) {
        TimeOffType type = types.findById(typeId).orElse(null);
        if (type == null) return;
        for (TimeOffRequest r : requests.findByEmployeeIdAndState(employeeId, "NEEDS_ATTENTION")) {
            if (!r.getTypeId().equals(typeId)) continue;
            BigDecimal available = balanceService.balance(employeeId, type).available();
            if (available.compareTo(r.getDays()) >= 0) {
                r.setState("PENDING");
                r.setAnomaly(null);
            }
        }
    }

    public BigDecimal computeDays(Long employeeId, LocalDate start, LocalDate end) {
        if (end.isBefore(start)) throw ApiException.validation("End date must not be before start date.");
        Employee e = employees.findById(employeeId).orElseThrow(() -> ApiException.notFound("employee"));
        WorkingSchedule schedule = e.getWorkingScheduleId() == null ? null :
                schedules.findById(e.getWorkingScheduleId()).orElse(null);
        Set<LocalDate> hol = new HashSet<>();
        holidays.findByDateBetween(start, end).forEach(h -> hol.add(h.getDate()));
        if (schedule == null) {
            long count = start.datesUntil(end.plusDays(1))
                    .filter(d -> d.getDayOfWeek().getValue() <= 5 && !hol.contains(d)).count();
            return BigDecimal.valueOf(count);
        }
        return BigDecimal.valueOf(scheduleService.workingDays(schedule, start, end, hol).size());
    }

    private Long requireEmployee() {
        Long emp = currentUser.employeeId();
        if (emp == null) throw new ApiException(ErrorCode.ILLEGAL_STATE, "Your account is not linked to an employee.");
        return emp;
    }
    private TypeDto toType(TimeOffType t) {
        return new TypeDto(t.getId(), t.getName(), t.getCode(), t.getUnit(), t.isPaid(),
                t.isRequiresAllocation(), t.getColor(), t.isActive());
    }
    private AllocationDto toAllocation(TimeOffAllocation a) {
        String emp = employees.findById(a.getEmployeeId()).map(Employee::getDisplayName).orElse(null);
        String tn = types.findById(a.getTypeId()).map(TimeOffType::getName).orElse(null);
        return new AllocationDto(a.getId(), a.getEmployeeId(), emp, a.getTypeId(), tn, a.getDays(),
                a.getValidFrom(), a.getValidTo(), a.getState(), a.getApprovedBy(), a.getApprovedAt(), a.getNote());
    }
    private RequestDto toRequest(TimeOffRequest r) {
        String emp = employees.findById(r.getEmployeeId()).map(Employee::getDisplayName).orElse(null);
        String tn = types.findById(r.getTypeId()).map(TimeOffType::getName).orElse(null);
        return new RequestDto(r.getId(), r.getEmployeeId(), emp, r.getTypeId(), tn, r.getStartDate(), r.getEndDate(),
                r.getDays(), r.getState(), r.getReason(), r.getAnomaly(), r.getDecidedBy(), r.getDecidedAt(),
                r.getDecisionNote());
    }
}
