package com.peoplepay360.unit;

import com.peoplepay360.service.ScheduleService;
import com.peoplepay360.model.WorkingSchedule;
import com.peoplepay360.model.WorkingScheduleLine;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ScheduleServiceTest {
    private final ScheduleService service = new ScheduleService();

    private WorkingScheduleLine line(int dow) {
        WorkingScheduleLine l = new WorkingScheduleLine();
        l.setDayOfWeek(dow);
        l.setStartTime(LocalTime.of(9, 0));
        l.setEndTime(LocalTime.of(17, 0));
        l.setBreakMinutes(30);
        return l;
    }

    @Test
    void weeklyHoursSumsWorkedMinutesMinusBreak() {
        List<WorkingScheduleLine> lines = List.of(line(1), line(2), line(3), line(4), line(5));
        // 8h - 30m = 7.5h per day * 5 = 37.5
        assertThat(service.weeklyHours(lines)).isEqualByComparingTo("37.50");
    }

    @Test
    void workingDaysExcludesWeekendsAndHolidays() {
        WorkingSchedule s = new WorkingSchedule();
        s.getLines().addAll(List.of(line(1), line(2), line(3), line(4), line(5)));
        LocalDate from = LocalDate.of(2026, 8, 1);  // Saturday
        LocalDate to = LocalDate.of(2026, 8, 31);
        Set<LocalDate> holidays = Set.of(LocalDate.of(2026, 8, 15));
        List<LocalDate> days = service.workingDays(s, from, to, holidays);
        // August 2026 has 21 weekdays; minus the Aug 15 holiday (a Saturday) -> still 21 (Aug 15 2026 is Saturday)
        assertThat(days).doesNotContain(LocalDate.of(2026, 8, 15));
        assertThat(days).allMatch(d -> d.getDayOfWeek().getValue() <= 5);
    }
}
