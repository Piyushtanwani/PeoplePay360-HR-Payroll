package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.Paging;
import com.peoplepay360.common.Periods;
import com.peoplepay360.common.Specs;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.config.AppProperties;
import com.peoplepay360.dto.AttendanceDtos.*;
import com.peoplepay360.model.Attendance;
import com.peoplepay360.model.AttendanceException;
import com.peoplepay360.model.Employee;
import com.peoplepay360.model.PublicHoliday;
import com.peoplepay360.model.TimeOffRequest;
import com.peoplepay360.model.WorkingSchedule;
import com.peoplepay360.repository.AttendanceExceptionRepository;
import com.peoplepay360.repository.AttendanceRepository;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.repository.PublicHolidayRepository;
import com.peoplepay360.repository.TimeOffRequestRepository;
import com.peoplepay360.repository.WorkingScheduleRepository;
import com.peoplepay360.security.CurrentUser;
import com.peoplepay360.security.ScopeResolver;
import com.peoplepay360.security.SelfActionGuard;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static com.peoplepay360.service.AttendanceClassifier.ABSENT;
import static com.peoplepay360.service.AttendanceClassifier.LATE;
import static com.peoplepay360.service.AttendanceClassifier.MISSING_CHECKOUT;
import static com.peoplepay360.service.AttendanceClassifier.OVERTIME;
import static com.peoplepay360.service.AttendanceClassifier.PRESENT;

@Service
public class AttendanceService {
    /** Public sort name -> entity property, for both list endpoints. */
    private static final Map<String, String> RECORD_SORTS = Map.of(
            "workDate", "workDate", "checkIn", "checkIn", "checkOut", "checkOut",
            "status", "status", "workedMinutes", "workedMinutes",
            "scheduledMinutes", "scheduledMinutes", "employeeId", "employeeId");
    private static final Sort RECORD_DEFAULT =
            Sort.by(Sort.Order.desc("workDate"), Sort.Order.asc("employeeId"));
    private static final Map<String, String> EXCEPTION_SORTS = Map.of(
            "date", "date", "type", "type", "minutes", "minutes",
            "resolved", "resolved", "employeeId", "employeeId");
    private static final Sort EXCEPTION_DEFAULT =
            Sort.by(Sort.Order.desc("date"), Sort.Order.asc("employeeId"));

    private final AttendanceRepository attendance;
    private final AttendanceExceptionRepository exceptions;
    private final EmployeeRepository employees;
    private final WorkingScheduleRepository schedules;
    private final PublicHolidayRepository holidays;
    private final TimeOffRequestRepository timeOffRequests;
    private final AttendanceClassifier classifier;
    private final ScheduleService scheduleService;
    private final CurrentUser currentUser;
    private final ScopeResolver scopeResolver;
    private final SelfActionGuard selfActionGuard;
    private final AuditService audit;
    private final AppProperties props;

    public AttendanceService(AttendanceRepository attendance, AttendanceExceptionRepository exceptions,
                             EmployeeRepository employees, WorkingScheduleRepository schedules,
                             PublicHolidayRepository holidays, TimeOffRequestRepository timeOffRequests,
                             AttendanceClassifier classifier, ScheduleService scheduleService,
                             CurrentUser currentUser, ScopeResolver scopeResolver,
                             SelfActionGuard selfActionGuard, AuditService audit, AppProperties props) {
        this.attendance = attendance;
        this.exceptions = exceptions;
        this.employees = employees;
        this.schedules = schedules;
        this.holidays = holidays;
        this.timeOffRequests = timeOffRequests;
        this.classifier = classifier;
        this.scheduleService = scheduleService;
        this.currentUser = currentUser;
        this.scopeResolver = scopeResolver;
        this.selfActionGuard = selfActionGuard;
        this.audit = audit;
        this.props = props;
    }

    // ------------------------------------------------------------------ reads

    /** Attendance records, newest day first. A caller without the .all scope only ever sees their own. */
    @PreAuthorize("hasAuthority('attendance.read.own')")
    @Transactional(readOnly = true)
    public Page<AttendanceDto> list(Long employeeId, Long departmentId, LocalDate from, LocalDate to,
                                    String status, String q, Pageable pageable) {
        Long scoped = scopeResolver.resolveEmployeeFilter("attendance.read.all", employeeId);
        List<Long> restrictTo = employeeIdsFor(departmentId, q);
        if (restrictTo != null && restrictTo.isEmpty()) return Page.empty(pageable);

        Specification<Attendance> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (scoped != null) ps.add(cb.equal(root.get("employeeId"), scoped));
            if (restrictTo != null) ps.add(Specs.in(cb, root.get("employeeId"), restrictTo));
            if (from != null) ps.add(cb.greaterThanOrEqualTo(root.get("workDate"), from));
            if (to != null) ps.add(cb.lessThanOrEqualTo(root.get("workDate"), to));
            if (status != null && !status.isBlank()) ps.add(cb.equal(root.get("status"), status));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        Page<Attendance> page = attendance.findAll(spec, Paging.normalise(pageable, RECORD_DEFAULT, RECORD_SORTS));
        Map<Long, Employee> names = employeesById(page.getContent().stream().map(Attendance::getEmployeeId).toList());
        return page.map(a -> toDto(a, names));
    }

    /** Open exceptions for a month, newest first. Department and employee filters are applied in SQL. */
    @PreAuthorize("hasAuthority('attendance.read.all')")
    @Transactional(readOnly = true)
    public Page<ExceptionDto> exceptions(String period, Long departmentId, Long employeeId, String type,
                                         Boolean resolved, Pageable pageable) {
        LocalDate[] range = Periods.month(period);
        List<Long> restrictTo = employeeIdsFor(departmentId, null);
        if (restrictTo != null && restrictTo.isEmpty()) return Page.empty(pageable);

        Specification<AttendanceException> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            ps.add(cb.between(root.get("date"), range[0], range[1]));
            if (restrictTo != null) ps.add(Specs.in(cb, root.get("employeeId"), restrictTo));
            if (employeeId != null) ps.add(cb.equal(root.get("employeeId"), employeeId));
            if (type != null && !type.isBlank()) ps.add(cb.equal(root.get("type"), type));
            if (resolved != null) ps.add(cb.equal(root.get("resolved"), resolved));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        Page<AttendanceException> page =
                exceptions.findAll(spec, Paging.normalise(pageable, EXCEPTION_DEFAULT, EXCEPTION_SORTS));
        List<Long> employeeIds = page.getContent().stream().map(AttendanceException::getEmployeeId).toList();
        Map<Long, Employee> byId = employeesById(employeeIds);
        Map<Long, WorkingSchedule> scheduleCache = new HashMap<>();
        return page.map(e -> toExceptionDto(e, byId, scheduleCache));
    }

    /** The classification rules currently in force, for the in-app help panel. */
    @PreAuthorize("hasAuthority('attendance.read.own')")
    public AttendanceRules rules() {
        AppProperties.Attendance cfg = props.getAttendance();
        List<RuleExplanation> statuses = List.of(
                new RuleExplanation(PRESENT, "Present",
                        "Checked in and out, within the scheduled hours for that weekday."),
                new RuleExplanation(LATE, "Late",
                        "Checked in more than " + cfg.getLateGraceMinutes()
                                + " minutes after the scheduled start. The day still counts as worked."),
                new RuleExplanation(OVERTIME, "Overtime",
                        "Worked more than " + cfg.getOvertimeThresholdMinutes()
                                + " minutes beyond the scheduled day. The excess feeds the OVERTIME_HOURS payroll input."),
                new RuleExplanation(ABSENT, "Absent",
                        "A scheduled working day with no check-in at all, detected by the nightly sweep."),
                new RuleExplanation(MISSING_CHECKOUT, "Missing check-out",
                        "Checked in but never checked out. Flagged once " + cfg.getMissingCheckoutAfterMinutes()
                                + " minutes have passed since the scheduled end."));
        List<RuleExplanation> edgeCases = List.of(
                new RuleExplanation("PRECEDENCE", "A day has exactly one status",
                        "A day that is both late and long is recorded as overtime, because the extra minutes are what "
                                + "payroll pays for and the lateness is still visible in the check-in time."),
                new RuleExplanation("NON_WORKING", "Weekends and holidays",
                        "Days the working schedule does not cover, and public holidays, are never marked absent. "
                                + "Work recorded on them is kept and counts as overtime when it exceeds zero scheduled minutes."),
                new RuleExplanation("LEAVE", "Approved leave",
                        "A day covered by an approved time-off request is never marked absent. Paid leave counts as a "
                                + "worked day for payroll; unpaid leave reduces pay through the UNPAID_DAYS input."),
                new RuleExplanation("NO_SCHEDULE", "Employees with no schedule",
                        "With no working schedule the scheduled minutes are zero, so lateness and absence cannot be "
                                + "determined and only present or missing check-out are produced."),
                new RuleExplanation("TIMEZONE", "Time zone",
                        "Stamps are stored as instants and compared against the schedule in " + props.getTimezone() + "."),
                new RuleExplanation("MANUAL", "Corrections",
                        "A correction records the original check-out, who changed it and why, marks the row as manually "
                                + "edited and reclassifies it. Nobody may correct their own attendance, including administrators."),
                new RuleExplanation("RESOLUTION", "Resolving an exception",
                        "Resolving records who resolved it, when, and the reason. For a missing check-out you may also "
                                + "supply the time, which closes the entry and reclassifies the day. Recomputing a period "
                                + "rebuilds statuses and exceptions from the stored stamps and never discards a resolution."));
        return new AttendanceRules(cfg.getLateGraceMinutes(), cfg.getOvertimeThresholdMinutes(),
                cfg.getMissingCheckoutAfterMinutes(), props.getTimezone(), statuses, edgeCases);
    }

    // ------------------------------------------------------------------ self service

    @PreAuthorize("hasAuthority('attendance.create.own')")
    @Transactional
    public AttendanceDto checkIn() {
        Long emp = requireEmployee();
        attendance.findByEmployeeIdAndCheckOutIsNull(emp).ifPresent(a -> {
            throw ApiException.illegalState("You already have an open attendance entry.");
        });
        Attendance a = new Attendance();
        a.setEmployeeId(emp);
        OffsetDateTime now = OffsetDateTime.now();
        a.setCheckIn(now);
        a.setWorkDate(now.atZoneSameInstant(zone()).toLocalDate());
        a.setStatus(MISSING_CHECKOUT);
        a = attendance.save(a);
        return toDto(a, employeesById(List.of(emp)));
    }

    @PreAuthorize("hasAuthority('attendance.create.own')")
    @Transactional
    public AttendanceDto checkOut() {
        Long emp = requireEmployee();
        Attendance a = attendance.findByEmployeeIdAndCheckOutIsNull(emp)
                .orElseThrow(() -> ApiException.illegalState("No open attendance entry."));
        a.setCheckOut(OffsetDateTime.now());
        reclassify(a);
        return toDto(a, employeesById(List.of(emp)));
    }

    @PreAuthorize("hasAuthority('attendance.create.own')")
    @Transactional(readOnly = true)
    public TodayView today() {
        Long emp = requireEmployee();
        Map<Long, Employee> names = employeesById(List.of(emp));
        AttendanceDto open = attendance.findByEmployeeIdAndCheckOutIsNull(emp)
                .map(a -> toDto(a, names)).orElse(null);
        List<AttendanceDto> rows = attendance.findByEmployeeIdAndWorkDate(emp, LocalDate.now(zone()))
                .stream().map(a -> toDto(a, names)).toList();
        return new TodayView(open, rows);
    }

    // ------------------------------------------------------------------ writes

    @PreAuthorize("hasAuthority('attendance.create.all')")
    @Transactional
    public AttendanceDto createManual(ManualRequest in) {
        Attendance a = new Attendance();
        a.setEmployeeId(in.employeeId());
        a.setCheckIn(in.checkIn());
        a.setCheckOut(in.checkOut());
        a.setWorkDate(in.workDate() != null ? in.workDate()
                : (in.checkIn() != null ? in.checkIn().atZoneSameInstant(zone()).toLocalDate() : LocalDate.now(zone())));
        a.setManualEdit(true);
        a.setEditedBy(currentUser.userId());
        a = attendance.save(a);
        reclassify(a);
        audit.record(Channel.UI, "CREATE_ATTENDANCE", "attendance", a.getId().toString(), "ALLOW", null, null, null);
        return toDto(a, employeesById(List.of(a.getEmployeeId())));
    }

    /** Corrects the stamps on a record. Never permitted on one's own record, for any role. */
    @PreAuthorize("hasAuthority('attendance.update.all')")
    @Transactional
    public AttendanceDto correct(Long id, CorrectRequest in) {
        Attendance a = attendance.findById(id).orElseThrow(() -> ApiException.notFound("attendance"));
        selfActionGuard.assertNotSelf(a.getEmployeeId(), "CORRECT_ATTENDANCE", "attendance");
        if (in.checkIn() != null && in.checkOut() != null && !in.checkOut().isAfter(in.checkIn())) {
            throw ApiException.validation("Check-out must be after check-in.");
        }
        Map<Long, Employee> names = employeesById(List.of(a.getEmployeeId()));
        String before = audit.toJson(toDto(a, names));
        if (a.getOriginalCheckOut() == null) a.setOriginalCheckOut(a.getCheckOut());
        if (in.checkIn() != null) a.setCheckIn(in.checkIn());
        if (in.checkOut() != null) a.setCheckOut(in.checkOut());
        a.setManualEdit(true);
        a.setEditedBy(currentUser.userId());
        a.setEditReason(in.editReason());
        reclassify(a);
        audit.record(Channel.UI, "CORRECT_ATTENDANCE", "attendance", id.toString(), "ALLOW",
                in.editReason(), before, audit.toJson(toDto(a, names)));
        return toDto(a, names);
    }

    @PreAuthorize("hasAuthority('attendance.delete.all')")
    @Transactional
    public void delete(Long id) {
        Attendance a = attendance.findById(id).orElseThrow(() -> ApiException.notFound("attendance"));
        exceptions.findByAttendanceId(id).ifPresent(exceptions::delete);
        attendance.delete(a);
        audit.record(Channel.UI, "DELETE_ATTENDANCE", "attendance", id.toString(), "ALLOW", null, null, null);
    }

    /**
     * Marks an exception resolved, recording who, when and why.
     *
     * <p>For a missing check-out the caller may also supply the time, which closes the underlying entry
     * and reclassifies the day. Types with no attendance row behind them, such as an absence, are
     * resolved with the reason alone.
     */
    @PreAuthorize("hasAuthority('attendance.update.all')")
    @Transactional
    public ExceptionDto resolveException(Long id, ResolveRequest in) {
        AttendanceException ex = exceptions.findById(id).orElseThrow(() -> ApiException.notFound("exception"));
        selfActionGuard.assertNotSelf(ex.getEmployeeId(), "RESOLVE_EXCEPTION", "attendance");
        String before = audit.toJson(toExceptionDto(ex, employeesById(List.of(ex.getEmployeeId())), new HashMap<>()));

        if (in.checkOut() != null) {
            if (ex.getAttendanceId() == null) {
                throw ApiException.validation(
                        "A check-out time only applies to a missing check-out. Resolve this one with a reason.");
            }
            Attendance a = attendance.findById(ex.getAttendanceId())
                    .orElseThrow(() -> ApiException.notFound("attendance"));
            if (a.getCheckIn() != null && !in.checkOut().isAfter(a.getCheckIn())) {
                throw ApiException.validation("Check-out must be after check-in.");
            }
            if (a.getOriginalCheckOut() == null) a.setOriginalCheckOut(a.getCheckOut());
            a.setCheckOut(in.checkOut());
            a.setManualEdit(true);
            a.setEditedBy(currentUser.userId());
            a.setEditReason(in.reason());
            // Reclassify only the record; the exception itself is being resolved here.
            classifier.classify(a, scheduleFor(a.getEmployeeId()));
        }

        ex.setResolved(true);
        ex.setResolvedBy(currentUser.userId());
        ex.setResolvedAt(OffsetDateTime.now());
        ex.setResolutionNote(in.reason());
        ExceptionDto after = toExceptionDto(ex, employeesById(List.of(ex.getEmployeeId())), new HashMap<>());
        audit.record(Channel.UI, "RESOLVE_EXCEPTION", "attendance", id.toString(), "ALLOW",
                in.reason(), before, audit.toJson(after));
        return after;
    }

    /**
     * Rebuilds statuses and exceptions for a month from the stored stamps, then sweeps the same days for
     * absences. Used to pick up schedule or holiday changes made after the fact.
     */
    @PreAuthorize("hasAuthority('attendance.update.all')")
    @Transactional
    public void recompute(String period) {
        LocalDate[] range = Periods.month(period);
        for (Attendance a : attendance.findAllInRange(range[0], range[1])) {
            reclassify(a);
        }
        LocalDate today = LocalDate.now(zone());
        for (LocalDate day = range[0]; !day.isAfter(range[1]) && day.isBefore(today); day = day.plusDays(1)) {
            buildAbsences(day);
        }
        audit.record(Channel.UI, "RECOMPUTE_ATTENDANCE", "attendance", period, "ALLOW", null, null, null);
    }

    /**
     * Creates an ABSENT record and exception for every employee who was scheduled to work on the given
     * day and has no attendance row. Skips non-working weekdays, public holidays and approved leave, and
     * is idempotent, so the nightly job and an on-demand recompute can both run it.
     *
     * <p>Not annotated: it is called from the scheduled job, which has no security context.
     */
    @Transactional
    public int buildAbsences(LocalDate day) {
        boolean isHoliday = !holidays.findByDateBetween(day, day).isEmpty();
        if (isHoliday) return 0;

        Set<Long> withRow = new HashSet<>();
        for (Attendance a : attendance.findAllInRange(day, day)) withRow.add(a.getEmployeeId());

        int created = 0;
        for (Employee e : employees.findActiveWithSchedule()) {
            if (withRow.contains(e.getId())) continue;
            WorkingSchedule schedule = scheduleFor(e.getId());
            if (schedule == null) continue;
            if (scheduleService.minutesForDay(schedule, day.getDayOfWeek().getValue()) <= 0) continue;
            if (onApprovedLeave(e.getId(), day)) continue;
            if (exceptions.existsByEmployeeIdAndDateAndType(e.getId(), day, ABSENT)) continue;

            Attendance a = new Attendance();
            a.setEmployeeId(e.getId());
            a.setWorkDate(day);
            a.setStatus(ABSENT);
            a.setScheduledMinutes(scheduleService.minutesForDay(schedule, day.getDayOfWeek().getValue()));
            a.setWorkedMinutes(0);
            attendance.save(a);
            syncException(a, schedule);
            created++;
        }
        return created;
    }

    /**
     * Flags entries that were never closed. An entry is only a problem once the working day is well over,
     * so a live check-in is left alone until the configured grace has passed.
     *
     * <p>Not annotated: called from the scheduled job.
     */
    @Transactional
    public int flagMissingCheckouts(LocalDate upTo) {
        int flagged = 0;
        for (Attendance a : attendance.findAllInRange(upTo.minusDays(30), upTo)) {
            if (a.getCheckIn() == null || a.getCheckOut() != null) continue;
            WorkingSchedule schedule = scheduleFor(a.getEmployeeId());
            LocalTime end = schedule == null ? null
                    : scheduleService.endForDay(schedule, a.getWorkDate().getDayOfWeek().getValue());
            OffsetDateTime cutoff = a.getWorkDate()
                    .atTime(end == null ? LocalTime.of(23, 59) : end)
                    .atZone(zone())
                    .plusMinutes(props.getAttendance().getMissingCheckoutAfterMinutes())
                    .toOffsetDateTime();
            if (OffsetDateTime.now().isBefore(cutoff)) continue;
            a.setStatus(MISSING_CHECKOUT);
            a.setWorkedMinutes(0);
            syncException(a, schedule);
            flagged++;
        }
        return flagged;
    }

    // ------------------------------------------------------------------ internals

    /** Classifies a record and brings its exception row into line with the resulting status. */
    private void reclassify(Attendance a) {
        WorkingSchedule schedule = scheduleFor(a.getEmployeeId());
        classifier.classify(a, schedule);
        syncException(a, schedule);
    }

    /**
     * One exception per day per employee, matching the current status.
     *
     * <p>A day that classifies as PRESENT resolves any exception left over from an earlier
     * classification, rather than deleting it, so the history of what was flagged survives.
     */
    private void syncException(Attendance a, WorkingSchedule schedule) {
        String type = exceptionTypeFor(a.getStatus());
        if (type == null) {
            exceptions.findByAttendanceId(a.getId()).ifPresent(ex -> {
                if (!ex.isResolved()) {
                    ex.setResolved(true);
                    ex.setResolvedAt(OffsetDateTime.now());
                    ex.setResolutionNote("Cleared automatically: the day no longer classifies as an exception.");
                }
            });
            return;
        }

        // A different exception type may exist for this day; close it before opening the new one.
        exceptions.findByAttendanceId(a.getId()).ifPresent(ex -> {
            if (!ex.getType().equals(type) && !ex.isResolved()) {
                ex.setResolved(true);
                ex.setResolvedAt(OffsetDateTime.now());
                ex.setResolutionNote("Superseded: the day now classifies as " + a.getStatus() + ".");
            }
        });

        Optional<AttendanceException> existing =
                exceptions.findByEmployeeIdAndDateAndType(a.getEmployeeId(), a.getWorkDate(), type);
        AttendanceException ex = existing.orElseGet(AttendanceException::new);
        ex.setEmployeeId(a.getEmployeeId());
        ex.setAttendanceId(a.getId());
        ex.setDate(a.getWorkDate());
        ex.setType(type);
        ex.setMinutes(minutesFor(a, schedule, type));
        if (ex.getId() == null) exceptions.save(ex);
    }

    private String exceptionTypeFor(String status) {
        return switch (status) {
            case LATE, OVERTIME, ABSENT, MISSING_CHECKOUT -> status;
            default -> null;
        };
    }

    private int minutesFor(Attendance a, WorkingSchedule schedule, String type) {
        return switch (type) {
            case LATE -> classifier.lateMinutes(a, schedule);
            case OVERTIME -> classifier.overtimeMinutes(a);
            case ABSENT -> a.getScheduledMinutes();
            default -> 0;
        };
    }

    private boolean onApprovedLeave(Long employeeId, LocalDate day) {
        List<TimeOffRequest> approved = timeOffRequests.findApprovedOverlapping(employeeId, day, day);
        return !approved.isEmpty();
    }

    /**
     * The employee ids a department or search term narrows to, or null when neither was supplied.
     * An empty list means "narrowed to nobody", which the callers turn into an empty page.
     */
    private List<Long> employeeIdsFor(Long departmentId, String q) {
        boolean hasQuery = q != null && !q.isBlank();
        if (departmentId == null && !hasQuery) return null;
        List<Long> ids = null;
        if (departmentId != null) ids = employees.findIdsByDepartmentId(departmentId);
        if (hasQuery) {
            List<Long> matches = employees.findIdsMatching("%" + q.toLowerCase() + "%");
            ids = ids == null ? matches : ids.stream().filter(matches::contains).toList();
        }
        return ids;
    }

    private Map<Long, Employee> employeesById(List<Long> ids) {
        Map<Long, Employee> map = new HashMap<>();
        if (ids == null || ids.isEmpty()) return map;
        employees.findAllById(new HashSet<>(ids)).forEach(e -> map.put(e.getId(), e));
        return map;
    }

    private WorkingSchedule scheduleFor(Long employeeId) {
        Employee e = employees.findById(employeeId).orElse(null);
        if (e == null || e.getWorkingScheduleId() == null) return null;
        return schedules.findById(e.getWorkingScheduleId()).orElse(null);
    }

    private Long requireEmployee() {
        Long emp = currentUser.employeeId();
        if (emp == null) throw ApiException.illegalState("Your account is not linked to an employee.");
        return emp;
    }

    private ZoneId zone() {
        return ZoneId.of(props.getTimezone());
    }

    private AttendanceDto toDto(Attendance a, Map<Long, Employee> names) {
        Employee e = names.get(a.getEmployeeId());
        return new AttendanceDto(a.getId(), a.getEmployeeId(), e == null ? null : e.getDisplayName(),
                a.getWorkDate(), a.getCheckIn(), a.getCheckOut(), a.getWorkedMinutes(), a.getScheduledMinutes(),
                a.getStatus(), a.isManualEdit(), a.getEditedBy(), a.getEditReason());
    }

    private ExceptionDto toExceptionDto(AttendanceException e, Map<Long, Employee> names,
                                        Map<Long, WorkingSchedule> scheduleCache) {
        Employee emp = names.get(e.getEmployeeId());
        LocalTime scheduledEnd = null;
        if (emp != null && emp.getWorkingScheduleId() != null) {
            WorkingSchedule ws = scheduleCache.computeIfAbsent(emp.getWorkingScheduleId(),
                    id -> schedules.findById(id).orElse(null));
            if (ws != null) scheduledEnd = scheduleService.endForDay(ws, e.getDate().getDayOfWeek().getValue());
        }
        return new ExceptionDto(e.getId(), e.getEmployeeId(), emp == null ? null : emp.getDisplayName(),
                e.getDate(), e.getType(), e.getMinutes(), e.isResolved(), e.getAttendanceId(), scheduledEnd,
                e.getResolvedBy(), e.getResolvedAt(), e.getResolutionNote());
    }
}
