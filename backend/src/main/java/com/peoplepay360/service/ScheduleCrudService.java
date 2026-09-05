package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.Paging;
import com.peoplepay360.common.Specs;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.config.AppProperties;
import com.peoplepay360.dto.ScheduleDtos.*;
import com.peoplepay360.model.WorkingSchedule;
import com.peoplepay360.model.WorkingScheduleLine;
import com.peoplepay360.repository.ContractRepository;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.repository.WorkingScheduleRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Working schedules: the weekly pattern that decides how many days and hours a period expects.
 *
 * <p>Weekly hours are always derived from the lines, never accepted from the client, because payroll
 * divides by them.
 */
@Service
public class ScheduleCrudService {
    private static final Map<String, String> SORTS =
            Map.of("name", "name", "type", "type", "weeklyHours", "weeklyHours", "active", "active");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("name"));

    private final WorkingScheduleRepository repo;
    private final EmployeeRepository employees;
    private final ContractRepository contracts;
    private final ScheduleService scheduleService;
    private final AppProperties props;
    private final AuditService audit;

    public ScheduleCrudService(WorkingScheduleRepository repo, EmployeeRepository employees,
                               ContractRepository contracts, ScheduleService scheduleService,
                               AppProperties props, AuditService audit) {
        this.repo = repo;
        this.employees = employees;
        this.contracts = contracts;
        this.scheduleService = scheduleService;
        this.props = props;
        this.audit = audit;
    }

    /** Names for pickers. Unpermissioned by design: every form that assigns a schedule needs it. */
    @Transactional(readOnly = true)
    public List<ScheduleName> names() {
        return repo.findAll(Sort.by("name")).stream()
                .filter(WorkingSchedule::isActive)
                .map(s -> new ScheduleName(s.getId(), s.getName(), s.getWeeklyHours()))
                .toList();
    }

    @PreAuthorize("hasAuthority('schedule.read.all')")
    @Transactional(readOnly = true)
    public Page<ScheduleDto> list(String q, Boolean active, Pageable pageable) {
        Specification<WorkingSchedule> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) ps.add(Specs.like(cb, root.get("name"), q));
            if (active != null) ps.add(cb.equal(root.get("active"), active));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return repo.findAll(spec, Paging.normalise(pageable, DEFAULT_SORT, SORTS)).map(this::toDto);
    }

    @PreAuthorize("hasAuthority('schedule.read.all')")
    @Transactional(readOnly = true)
    public ScheduleDto get(Long id) {
        return toDto(require(id));
    }

    @PreAuthorize("hasAuthority('schedule.create.all')")
    @Transactional
    public ScheduleDto create(SaveSchedule in) {
        if (repo.existsByNameIgnoreCase(in.name().trim())) {
            throw ApiException.conflict("A working schedule named " + in.name().trim() + " already exists.");
        }
        ScheduleDto dto = save(new WorkingSchedule(), in);
        audit.record(Channel.UI, "CREATE_SCHEDULE", "working_schedule", String.valueOf(dto.id()), "ALLOW",
                null, null, audit.toJson(dto));
        return dto;
    }

    @PreAuthorize("hasAuthority('schedule.update.all')")
    @Transactional
    public ScheduleDto update(Long id, SaveSchedule in) {
        WorkingSchedule s = require(id);
        String before = audit.toJson(toDto(s));
        if (!s.getName().equalsIgnoreCase(in.name().trim()) && repo.existsByNameIgnoreCase(in.name().trim())) {
            throw ApiException.conflict("A working schedule named " + in.name().trim() + " already exists.");
        }
        s.getLines().clear();
        ScheduleDto dto = save(s, in);
        audit.record(Channel.UI, "UPDATE_SCHEDULE", "working_schedule", id.toString(), "ALLOW",
                null, before, audit.toJson(dto));
        return dto;
    }

    /**
     * Refused while employees or contracts still point at the schedule. Removing it under them would
     * leave payroll with no way to count a scheduled day.
     */
    @PreAuthorize("hasAuthority('schedule.delete.all')")
    @Transactional
    public void delete(Long id) {
        WorkingSchedule s = require(id);
        long staffed = employees.findAll().stream()
                .filter(e -> id.equals(e.getWorkingScheduleId()))
                .count();
        if (staffed > 0) {
            throw ApiException.illegalState(staffed + " employee(s) use this schedule. "
                    + "Move them to another schedule, or deactivate this one instead.");
        }
        long contracted = contracts.findAll().stream()
                .filter(c -> id.equals(c.getWorkingScheduleId()) && !"CANCELLED".equals(c.getState()))
                .count();
        if (contracted > 0) {
            throw ApiException.illegalState(contracted + " live contract(s) use this schedule. "
                    + "Deactivate it instead.");
        }
        audit.record(Channel.UI, "DELETE_SCHEDULE", "working_schedule", id.toString(), "ALLOW",
                s.getName(), audit.toJson(toDto(s)), null);
        repo.delete(s);
    }

    /**
     * Validates and stores the weekly pattern. The client sends one line per working day; days it omits
     * are simply not working days.
     */
    private ScheduleDto save(WorkingSchedule s, SaveSchedule in) {
        s.setName(in.name().trim());
        s.setType(in.type() == null || in.type().isBlank() ? "FIXED" : in.type());
        if (in.active() != null) s.setActive(in.active());

        List<LineDto> lines = in.lines() == null ? List.of() : in.lines();
        if (lines.isEmpty()) {
            throw ApiException.validation("A schedule needs at least one working day.");
        }
        Set<Integer> seen = new HashSet<>();
        for (LineDto l : lines) {
            if (l.dayOfWeek() < 1 || l.dayOfWeek() > 7) {
                throw ApiException.validation("Day of week must be 1 (Monday) to 7 (Sunday).");
            }
            if (!seen.add(l.dayOfWeek())) {
                throw ApiException.validation("Day " + l.dayOfWeek() + " appears more than once.");
            }
            if (l.startTime() == null || l.endTime() == null) {
                throw ApiException.validation("Each working day needs a start and an end time.");
            }
            if (!l.endTime().isAfter(l.startTime())) {
                throw ApiException.validation("The end time must be after the start time on day " + l.dayOfWeek() + ".");
            }
            long span = java.time.Duration.between(l.startTime(), l.endTime()).toMinutes();
            if (l.breakMinutes() < 0 || l.breakMinutes() >= span) {
                throw ApiException.validation("The break on day " + l.dayOfWeek()
                        + " must be shorter than the working span.");
            }
            WorkingScheduleLine line = new WorkingScheduleLine();
            line.setDayOfWeek(l.dayOfWeek());
            line.setStartTime(l.startTime());
            line.setEndTime(l.endTime());
            line.setBreakMinutes(l.breakMinutes());
            s.addLine(line);
        }
        s.setWeeklyHours(scheduleService.weeklyHours(s.getLines()));
        return toDto(repo.save(s));
    }

    private WorkingSchedule require(Long id) {
        return repo.findById(id).orElseThrow(() -> ApiException.notFound("schedule"));
    }

    private ScheduleDto toDto(WorkingSchedule s) {
        List<LineDto> lines = s.getLines().stream()
                .sorted(java.util.Comparator.comparingInt(WorkingScheduleLine::getDayOfWeek)
                        .thenComparing(WorkingScheduleLine::getStartTime, LocalTime::compareTo))
                .map(l -> new LineDto(l.getDayOfWeek(), l.getStartTime(), l.getEndTime(), l.getBreakMinutes()))
                .toList();
        return new ScheduleDto(s.getId(), s.getName(), s.getType(), s.getWeeklyHours(), s.isActive(),
                props.getCompanyName(), lines);
    }
}
