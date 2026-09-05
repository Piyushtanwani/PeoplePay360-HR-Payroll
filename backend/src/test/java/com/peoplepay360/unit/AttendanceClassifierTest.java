package com.peoplepay360.unit;

import com.peoplepay360.config.AppProperties;
import com.peoplepay360.model.Attendance;
import com.peoplepay360.model.WorkingSchedule;
import com.peoplepay360.model.WorkingScheduleLine;
import com.peoplepay360.service.AttendanceClassifier;
import com.peoplepay360.service.ScheduleService;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Boundaries of the attendance classifier. The company timezone is pinned to UTC here so the
 * assertions read as wall-clock times rather than needing an offset in the head.
 */
class AttendanceClassifierTest {
    private static final int GRACE_MINUTES = 10;
    private static final int OVERTIME_THRESHOLD_MINUTES = 30;

    private final AttendanceClassifier classifier = new AttendanceClassifier(new ScheduleService(), props());

    private AppProperties props() {
        AppProperties p = new AppProperties();
        p.setTimezone("UTC");
        p.getAttendance().setLateGraceMinutes(GRACE_MINUTES);
        p.getAttendance().setOvertimeThresholdMinutes(OVERTIME_THRESHOLD_MINUTES);
        return p;
    }

    /** Monday to Friday, 09:00 to 17:00 with a 30 minute break, so 7.5 scheduled hours. */
    private WorkingSchedule schedule() {
        WorkingSchedule s = new WorkingSchedule();
        for (int day = 1; day <= 5; day++) {
            WorkingScheduleLine l = new WorkingScheduleLine();
            l.setDayOfWeek(day);
            l.setStartTime(LocalTime.of(9, 0));
            l.setEndTime(LocalTime.of(17, 0));
            l.setBreakMinutes(30);
            s.addLine(l);
        }
        return s;
    }

    private Attendance att(OffsetDateTime in, OffsetDateTime out) {
        Attendance a = new Attendance();
        a.setEmployeeId(1L);
        a.setWorkDate(LocalDate.of(2026, 8, 3)); // a Monday
        a.setCheckIn(in);
        a.setCheckOut(out);
        return a;
    }

    private OffsetDateTime t(int hour, int minute) {
        return OffsetDateTime.of(2026, 8, 3, hour, minute, 0, 0, ZoneOffset.UTC);
    }

    @Test
    void presentWhenWithinSchedule() {
        Attendance a = att(t(9, 0), t(17, 0));
        classifier.classify(a, schedule());
        assertThat(a.getStatus()).isEqualTo(AttendanceClassifier.PRESENT);
        assertThat(a.getScheduledMinutes()).isEqualTo(450);
        assertThat(a.getWorkedMinutes()).isEqualTo(480);
    }

    @Test
    void withinGraceIsStillPresent() {
        Attendance a = att(t(9, GRACE_MINUTES), t(17, 0));
        classifier.classify(a, schedule());
        assertThat(a.getStatus()).isEqualTo(AttendanceClassifier.PRESENT);
    }

    @Test
    void oneMinutePastGraceIsLate() {
        Attendance a = att(t(9, GRACE_MINUTES + 1), t(16, 30));
        classifier.classify(a, schedule());
        assertThat(a.getStatus()).isEqualTo(AttendanceClassifier.LATE);
        assertThat(classifier.lateMinutes(a, schedule())).isEqualTo(GRACE_MINUTES + 1);
    }

    @Test
    void exactlyAtTheOvertimeThresholdIsNotOvertime() {
        // 450 scheduled + 30 threshold = 480 worked, which is not "more than".
        Attendance a = att(t(9, 0), t(17, 0));
        classifier.classify(a, schedule());
        assertThat(a.getWorkedMinutes()).isEqualTo(450 + OVERTIME_THRESHOLD_MINUTES);
        assertThat(a.getStatus()).isEqualTo(AttendanceClassifier.PRESENT);
        assertThat(classifier.overtimeMinutes(a)).isZero();
    }

    @Test
    void oneMinutePastTheThresholdIsOvertime() {
        Attendance a = att(t(9, 0), t(17, 1));
        classifier.classify(a, schedule());
        assertThat(a.getStatus()).isEqualTo(AttendanceClassifier.OVERTIME);
        assertThat(classifier.overtimeMinutes(a)).isEqualTo(31);
    }

    @Test
    void lateAndLongIsRecordedAsOvertime() {
        // Payroll pays for the extra minutes; the lateness is still visible in the check-in time.
        Attendance a = att(t(10, 0), t(20, 0));
        classifier.classify(a, schedule());
        assertThat(a.getStatus()).isEqualTo(AttendanceClassifier.OVERTIME);
        assertThat(classifier.lateMinutes(a, schedule())).isZero();
    }

    @Test
    void missingCheckoutWhenNoCheckout() {
        Attendance a = att(t(9, 0), null);
        classifier.classify(a, schedule());
        assertThat(a.getStatus()).isEqualTo(AttendanceClassifier.MISSING_CHECKOUT);
        assertThat(a.getWorkedMinutes()).isZero();
    }

    @Test
    void withoutAScheduleLatenessCannotBeDetermined() {
        Attendance a = att(t(11, 0), t(15, 0));
        classifier.classify(a, null);
        assertThat(a.getScheduledMinutes()).isZero();
        assertThat(a.getStatus()).isEqualTo(AttendanceClassifier.PRESENT);
    }

    @Test
    void anAbsenceKeepsItsStatusAndZeroWorkedMinutes() {
        Attendance a = att(null, null);
        a.setStatus(AttendanceClassifier.ABSENT);
        classifier.classify(a, schedule());
        assertThat(a.getStatus()).isEqualTo(AttendanceClassifier.ABSENT);
        assertThat(a.getScheduledMinutes()).isEqualTo(450);
        assertThat(a.getWorkedMinutes()).isZero();
    }

    @Test
    void aNonWorkingDayHasNoScheduledMinutes() {
        Attendance a = att(t(9, 0), t(17, 0));
        a.setWorkDate(LocalDate.of(2026, 8, 8)); // Saturday
        classifier.classify(a, schedule());
        assertThat(a.getScheduledMinutes()).isZero();
        assertThat(a.getStatus()).isEqualTo(AttendanceClassifier.PRESENT);
    }
}
