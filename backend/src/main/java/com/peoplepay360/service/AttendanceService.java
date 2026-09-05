package com.peoplepay360.service;

import com.peoplepay360.dto.AttendanceDtos.*;
import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.common.Periods;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.model.Employee;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.model.WorkingSchedule;
import com.peoplepay360.repository.WorkingScheduleRepository;
import com.peoplepay360.security.CurrentUser;
import com.peoplepay360.security.ScopeResolver;
import com.peoplepay360.security.SelfActionGuard;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import com.peoplepay360.model.Attendance;
import com.peoplepay360.model.AttendanceException;
import com.peoplepay360.repository.AttendanceExceptionRepository;
import com.peoplepay360.repository.AttendanceRepository;

@Service
public class AttendanceService {
    private final AttendanceRepository attendance;
    private final AttendanceExceptionRepository exceptions;
    private final EmployeeRepository employees;
    private final WorkingScheduleRepository schedules;
    private final AttendanceClassifier classifier;
    private final CurrentUser currentUser;
    private final ScopeResolver scopeResolver;
    private final SelfActionGuard selfActionGuard;
    private final AuditService audit;

    public AttendanceService(AttendanceRepository attendance, AttendanceExceptionRepository exceptions,
                             EmployeeRepository employees, WorkingScheduleRepository schedules,
                             AttendanceClassifier classifier, CurrentUser currentUser, ScopeResolver scopeResolver,
                             SelfActionGuard selfActionGuard, AuditService audit) {
        this.attendance = attendance;
        this.exceptions = exceptions;
        this.employees = employees;
        this.schedules = schedules;
        this.classifier = classifier;
        this.currentUser = currentUser;
        this.scopeResolver = scopeResolver;
        this.selfActionGuard = selfActionGuard;
        this.audit = audit;
    }

    @PreAuthorize("hasAuthority('attendance.read.own')")
    @Transactional(readOnly = true)
    public List<AttendanceDto> list(Long employeeId, LocalDate from, LocalDate to, String status) {
        Long scoped = scopeResolver.resolveEmployeeFilter("attendance.read.all", employeeId);
        Specification<Attendance> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (scoped != null) ps.add(cb.equal(root.get("employeeId"), scoped));
            if (from != null) ps.add(cb.greaterThanOrEqualTo(root.get("workDate"), from));
            if (to != null) ps.add(cb.lessThanOrEqualTo(root.get("workDate"), to));
            if (status != null) ps.add(cb.equal(root.get("status"), status));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return attendance.findAll(spec).stream().map(this::toDto).toList();
    }

    @PreAuthorize("hasAuthority('attendance.create.own')")
    @Transactional
    public AttendanceDto checkIn() {
        Long emp = requireEmployee();
        attendance.findByEmployeeIdAndCheckOutIsNull(emp).ifPresent(a -> {
            throw new ApiException(ErrorCode.ILLEGAL_STATE, "You already have an open attendance entry.");
        });
        Attendance a = new Attendance();
        a.setEmployeeId(emp);
        OffsetDateTime now = OffsetDateTime.now();
        a.setCheckIn(now);
        a.setWorkDate(now.toLocalDate());
        a.setStatus("MISSING_CHECKOUT");
        a = attendance.save(a);
        return toDto(a);
    }

    @PreAuthorize("hasAuthority('attendance.create.own')")
    @Transactional
    public AttendanceDto checkOut() {
        Long emp = requireEmployee();
        Attendance a = attendance.findByEmployeeIdAndCheckOutIsNull(emp)
                .orElseThrow(() -> new ApiException(ErrorCode.ILLEGAL_STATE, "No open attendance entry."));
        a.setCheckOut(OffsetDateTime.now());
        classifier.classify(a, scheduleFor(emp));
        return toDto(a);
    }

    @PreAuthorize("hasAuthority('attendance.create.own')")
    @Transactional(readOnly = true)
    public TodayView today() {
        Long emp = requireEmployee();
        AttendanceDto open = attendance.findByEmployeeIdAndCheckOutIsNull(emp).map(this::toDto).orElse(null);
        List<AttendanceDto> rows = attendance.findByEmployeeIdAndWorkDate(emp, LocalDate.now())
                .stream().map(this::toDto).toList();
        return new TodayView(open, rows);
    }

    @PreAuthorize("hasAuthority('attendance.create.all')")
    @Transactional
    public AttendanceDto createManual(ManualRequest in) {
        Attendance a = new Attendance();
        a.setEmployeeId(in.employeeId());
        a.setCheckIn(in.checkIn());
        a.setCheckOut(in.checkOut());
        a.setWorkDate(in.workDate() != null ? in.workDate() :
                (in.checkIn() != null ? in.checkIn().toLocalDate() : LocalDate.now()));
        a.setManualEdit(true);
        a.setEditedBy(currentUser.userId());
        classifier.classify(a, scheduleFor(in.employeeId()));
        a = attendance.save(a);
        audit.record(Channel.UI, "CREATE_ATTENDANCE", "attendance", a.getId().toString(), "ALLOW", null, null, null);
        return toDto(a);
    }

    @PreAuthorize("hasAuthority('attendance.update.all')")
    @Transactional
    public AttendanceDto correct(Long id, CorrectRequest in) {
        Attendance a = attendance.findById(id).orElseThrow(() -> ApiException.notFound("attendance"));
        selfActionGuard.assertNotSelf(a.getEmployeeId(), "CORRECT_ATTENDANCE", "attendance");
        if (in.editReason() == null || in.editReason().isBlank()) {
            throw ApiException.validation("A correction reason is required.");
        }
        String before = audit.toJson(toDto(a));
        a.setOriginalCheckOut(a.getCheckOut());
        if (in.checkIn() != null) a.setCheckIn(in.checkIn());
        if (in.checkOut() != null) a.setCheckOut(in.checkOut());
        a.setManualEdit(true);
        a.setEditedBy(currentUser.userId());
        a.setEditReason(in.editReason());
        classifier.classify(a, scheduleFor(a.getEmployeeId()));
        exceptions.findByAttendanceId(a.getId()).ifPresent(ex -> { ex.setResolved(true); });
        audit.record(Channel.UI, "CORRECT_ATTENDANCE", "attendance", id.toString(), "ALLOW",
                in.editReason(), before, audit.toJson(toDto(a)));
        return toDto(a);
    }

    @PreAuthorize("hasAuthority('attendance.delete.all')")
    @Transactional
    public void delete(Long id) { attendance.deleteById(id); }

    @PreAuthorize("hasAuthority('attendance.read.all')")
    @Transactional(readOnly = true)
    public List<ExceptionDto> exceptions(String period, Long departmentId, String type, Boolean resolved) {
        LocalDate[] range = Periods.month(period);
        return exceptions.findRange(range[0], range[1]).stream()
                .filter(e -> type == null || e.getType().equals(type))
                .filter(e -> resolved == null || e.isResolved() == resolved)
                .map(this::toExceptionDto)
                .toList();
    }

    @PreAuthorize("hasAuthority('attendance.update.all')")
    @Transactional
    public void resolveException(Long id, ResolveRequest in) {
        AttendanceException ex = exceptions.findById(id).orElseThrow(() -> ApiException.notFound("exception"));
        ex.setResolved(true);
        if (ex.getAttendanceId() != null && in.checkOut() != null) {
            attendance.findById(ex.getAttendanceId()).ifPresent(a -> {
                a.setCheckOut(in.checkOut());
                a.setManualEdit(true);
                a.setEditReason(in.reason());
                classifier.classify(a, scheduleFor(a.getEmployeeId()));
            });
        }
        audit.record(Channel.UI, "RESOLVE_EXCEPTION", "attendance", id.toString(), "ALLOW", in.reason(), null, null);
    }

    @PreAuthorize("hasAuthority('attendance.update.all')")
    @Transactional
    public void recompute(String period) {
        LocalDate[] range = Periods.month(period);
        for (Attendance a : attendance.findAllInRange(range[0], range[1])) {
            classifier.classify(a, scheduleFor(a.getEmployeeId()));
        }
    }

    private WorkingSchedule scheduleFor(Long employeeId) {
        Employee e = employees.findById(employeeId).orElse(null);
        if (e == null || e.getWorkingScheduleId() == null) return null;
        return schedules.findById(e.getWorkingScheduleId()).orElse(null);
    }
    private Long requireEmployee() {
        Long emp = currentUser.employeeId();
        if (emp == null) throw new ApiException(ErrorCode.ILLEGAL_STATE, "Your account is not linked to an employee.");
        return emp;
    }
    private AttendanceDto toDto(Attendance a) {
        String name = employees.findById(a.getEmployeeId()).map(Employee::getDisplayName).orElse(null);
        return new AttendanceDto(a.getId(), a.getEmployeeId(), name, a.getWorkDate(), a.getCheckIn(), a.getCheckOut(),
                a.getWorkedMinutes(), a.getScheduledMinutes(), a.getStatus(), a.isManualEdit(),
                a.getEditedBy(), a.getEditReason());
    }
    private ExceptionDto toExceptionDto(AttendanceException e) {
        String name = employees.findById(e.getEmployeeId()).map(Employee::getDisplayName).orElse(null);
        return new ExceptionDto(e.getId(), e.getEmployeeId(), name, e.getDate(), e.getType(), e.getMinutes(),
                e.isResolved(), e.getAttendanceId());
    }
}
