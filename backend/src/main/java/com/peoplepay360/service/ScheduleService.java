package com.peoplepay360.service;

import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import com.peoplepay360.model.WorkingSchedule;
import com.peoplepay360.model.WorkingScheduleLine;

/** Computes weekly hours and enumerates working days; both derived from the schedule, never entered by clients. */
@Service
public class ScheduleService {

    public BigDecimal weeklyHours(List<WorkingScheduleLine> lines) {
        long minutes = 0;
        for (WorkingScheduleLine l : lines) {
            long worked = Duration.between(l.getStartTime(), l.getEndTime()).toMinutes() - l.getBreakMinutes();
            if (worked > 0) minutes += worked;
        }
        return BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }

    /** Minutes worked on the given weekday (1=Mon..7=Sun) per the schedule, or 0 if not a working day. */
    public int minutesForDay(WorkingSchedule schedule, int dayOfWeek) {
        return schedule.getLines().stream()
                .filter(l -> l.getDayOfWeek() == dayOfWeek)
                .mapToInt(l -> (int) (Duration.between(l.getStartTime(), l.getEndTime()).toMinutes() - l.getBreakMinutes()))
                .filter(m -> m > 0)
                .sum();
    }


    /** Earliest start time on the given weekday (1=Mon..7=Sun), or null when it is not a working day. */
    public LocalTime startForDay(WorkingSchedule schedule, int dayOfWeek) {
        return schedule.getLines().stream()
                .filter(l -> l.getDayOfWeek() == dayOfWeek)
                .map(WorkingScheduleLine::getStartTime)
                .min(LocalTime::compareTo)
                .orElse(null);
    }

    /** Latest end time on the given weekday, or null when it is not a working day. */
    public LocalTime endForDay(WorkingSchedule schedule, int dayOfWeek) {
        return schedule.getLines().stream()
                .filter(l -> l.getDayOfWeek() == dayOfWeek)
                .map(WorkingScheduleLine::getEndTime)
                .max(LocalTime::compareTo)
                .orElse(null);
    }

    public List<LocalDate> workingDays(WorkingSchedule schedule, LocalDate from, LocalDate to, Set<LocalDate> holidays) {
        Set<Integer> workingDows = schedule.getLines().stream()
                .map(WorkingScheduleLine::getDayOfWeek).collect(java.util.stream.Collectors.toSet());
        return from.datesUntil(to.plusDays(1))
                .filter(d -> workingDows.contains(d.getDayOfWeek().getValue()))
                .filter(d -> !holidays.contains(d))
                .toList();
    }
}
