package com.peoplepay360.schedule;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.schedule.ScheduleDtos.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ScheduleCrudService {
    private final WorkingScheduleRepository repo;
    private final ScheduleService scheduleService;
    public ScheduleCrudService(WorkingScheduleRepository repo, ScheduleService scheduleService) {
        this.repo = repo;
        this.scheduleService = scheduleService;
    }

    @Transactional(readOnly = true)
    public List<ScheduleName> names() {
        return repo.findAll().stream().map(s -> new ScheduleName(s.getId(), s.getName(), s.getWeeklyHours())).toList();
    }

    @PreAuthorize("hasAuthority('schedule.read.all')")
    @Transactional(readOnly = true)
    public List<ScheduleDto> list() { return repo.findAll().stream().map(this::toDto).toList(); }

    @PreAuthorize("hasAuthority('schedule.read.all')")
    @Transactional(readOnly = true)
    public ScheduleDto get(Long id) {
        return toDto(repo.findById(id).orElseThrow(() -> ApiException.notFound("schedule")));
    }

    @PreAuthorize("hasAuthority('schedule.create.all')")
    @Transactional
    public ScheduleDto create(SaveSchedule in) { return save(new WorkingSchedule(), in); }

    @PreAuthorize("hasAuthority('schedule.update.all')")
    @Transactional
    public ScheduleDto update(Long id, SaveSchedule in) {
        WorkingSchedule s = repo.findById(id).orElseThrow(() -> ApiException.notFound("schedule"));
        s.getLines().clear();
        return save(s, in);
    }

    @PreAuthorize("hasAuthority('schedule.delete.all')")
    @Transactional
    public void delete(Long id) { repo.deleteById(id); }

    private ScheduleDto save(WorkingSchedule s, SaveSchedule in) {
        s.setName(in.name());
        s.setType(in.type() == null ? "FIXED" : in.type());
        if (in.lines() != null) {
            for (LineDto l : in.lines()) {
                WorkingScheduleLine line = new WorkingScheduleLine();
                line.setScheduleId(s.getId());
                line.setDayOfWeek(l.dayOfWeek());
                line.setStartTime(l.startTime());
                line.setEndTime(l.endTime());
                line.setBreakMinutes(l.breakMinutes());
                s.getLines().add(line);
            }
        }
        s.setWeeklyHours(scheduleService.weeklyHours(s.getLines()));
        s = repo.save(s);
        // ensure line scheduleId is set after persist for new schedules
        for (WorkingScheduleLine line : s.getLines()) line.setScheduleId(s.getId());
        s = repo.save(s);
        return toDto(s);
    }

    private ScheduleDto toDto(WorkingSchedule s) {
        List<LineDto> lines = s.getLines().stream()
                .map(l -> new LineDto(l.getDayOfWeek(), l.getStartTime(), l.getEndTime(), l.getBreakMinutes()))
                .toList();
        return new ScheduleDto(s.getId(), s.getName(), s.getType(), s.getWeeklyHours(), lines);
    }
}
