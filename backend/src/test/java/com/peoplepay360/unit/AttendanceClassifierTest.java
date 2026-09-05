package com.peoplepay360.unit;

import com.peoplepay360.model.Attendance;
import com.peoplepay360.service.AttendanceClassifier;
import com.peoplepay360.service.ScheduleService;
import com.peoplepay360.model.WorkingSchedule;
import com.peoplepay360.model.WorkingScheduleLine;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class AttendanceClassifierTest {
    private final AttendanceClassifier classifier = new AttendanceClassifier(new ScheduleService());

    private WorkingSchedule schedule() {
        WorkingSchedule s = new WorkingSchedule();
        for (int d = 1; d <= 5; d++) {
            WorkingScheduleLine l = new WorkingScheduleLine();
            l.setDayOfWeek(d); l.setStartTime(LocalTime.of(9, 0)); l.setEndTime(LocalTime.of(17, 0)); l.setBreakMinutes(30);
            s.getLines().add(l);
        }
        return s;
    }
    private Attendance att(OffsetDateTime in, OffsetDateTime out) {
        Attendance a = new Attendance();
        a.setEmployeeId(1L);
        a.setWorkDate(LocalDate.of(2026, 8, 3)); // Monday
        a.setCheckIn(in); a.setCheckOut(out);
        return a;
    }
    private OffsetDateTime t(int h, int m) {
        return OffsetDateTime.of(2026, 8, 3, h, m, 0, 0, ZoneOffset.UTC);
    }

    @Test
    void presentWhenWithinSchedule() {
        Attendance a = att(t(9, 0), t(17, 0));
        classifier.classify(a, schedule());
        assertThat(a.getStatus()).isEqualTo("PRESENT");
    }

    @Test
    void overtimeWhenWorkedExceedsScheduledPlusThreshold() {
        Attendance a = att(t(9, 0), t(19, 0)); // 10h worked vs 7.5h scheduled
        classifier.classify(a, schedule());
        assertThat(a.getStatus()).isEqualTo("OVERTIME");
    }

    @Test
    void missingCheckoutWhenNoCheckout() {
        Attendance a = att(t(9, 0), null);
        classifier.classify(a, schedule());
        assertThat(a.getStatus()).isEqualTo("MISSING_CHECKOUT");
    }
}
