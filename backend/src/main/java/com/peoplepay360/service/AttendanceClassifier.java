package com.peoplepay360.service;

import com.peoplepay360.config.AppProperties;
import com.peoplepay360.model.Attendance;
import com.peoplepay360.model.WorkingSchedule;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalTime;
import java.time.ZoneId;

/**
 * Derives an attendance row's status from its stamps and the schedule line for that weekday.
 *
 * <p>Precedence is deliberate and payroll-first: a day that is both late and long is recorded as
 * OVERTIME, because the extra minutes are what payroll pays for, and the lateness is already visible
 * in the check-in time. Only one status, and therefore only one exception row, exists per day.
 *
 * <p>ABSENT is not decided here. It is the absence of a row, which only a sweep over the calendar can
 * see, so {@link AttendanceService#buildAbsences} owns it.
 */
@Component
public class AttendanceClassifier {
    public static final String PRESENT = "PRESENT";
    public static final String LATE = "LATE";
    public static final String OVERTIME = "OVERTIME";
    public static final String ABSENT = "ABSENT";
    public static final String MISSING_CHECKOUT = "MISSING_CHECKOUT";

    private final ScheduleService scheduleService;
    private final AppProperties props;

    public AttendanceClassifier(ScheduleService scheduleService, AppProperties props) {
        this.scheduleService = scheduleService;
        this.props = props;
    }

    /** Sets scheduledMinutes, workedMinutes and status on the row. */
    public void classify(Attendance a, WorkingSchedule schedule) {
        int dayOfWeek = a.getWorkDate().getDayOfWeek().getValue();
        int scheduled = schedule == null ? 0 : scheduleService.minutesForDay(schedule, dayOfWeek);
        a.setScheduledMinutes(scheduled);

        if (ABSENT.equals(a.getStatus()) && a.getCheckIn() == null) {
            a.setWorkedMinutes(0);
            return;
        }
        if (a.getCheckIn() == null) {
            a.setWorkedMinutes(0);
            return;
        }
        if (a.getCheckOut() == null) {
            // Still open. Payroll counts no worked days for an entry that was never closed.
            a.setStatus(MISSING_CHECKOUT);
            a.setWorkedMinutes(0);
            return;
        }

        int worked = (int) Duration.between(a.getCheckIn(), a.getCheckOut()).toMinutes();
        a.setWorkedMinutes(Math.max(worked, 0));

        int overtimeThreshold = props.getAttendance().getOvertimeThresholdMinutes();
        if (scheduled > 0 && worked > scheduled + overtimeThreshold) {
            a.setStatus(OVERTIME);
            return;
        }
        a.setStatus(isLate(a, schedule) ? LATE : PRESENT);
    }

    /** Minutes beyond the scheduled day, zero unless the row is classified OVERTIME. */
    public int overtimeMinutes(Attendance a) {
        if (!OVERTIME.equals(a.getStatus())) return 0;
        return Math.max(0, a.getWorkedMinutes() - a.getScheduledMinutes());
    }

    /** Minutes past the scheduled start, zero unless the row is classified LATE. */
    public int lateMinutes(Attendance a, WorkingSchedule schedule) {
        if (!LATE.equals(a.getStatus()) || schedule == null || a.getCheckIn() == null) return 0;
        LocalTime start = scheduleService.startForDay(schedule, a.getWorkDate().getDayOfWeek().getValue());
        if (start == null) return 0;
        LocalTime actual = a.getCheckIn().atZoneSameInstant(zone()).toLocalTime();
        return Math.max(0, (int) Duration.between(start, actual).toMinutes());
    }

    private boolean isLate(Attendance a, WorkingSchedule schedule) {
        if (schedule == null) return false;
        LocalTime start = scheduleService.startForDay(schedule, a.getWorkDate().getDayOfWeek().getValue());
        if (start == null) return false;
        // Stamps are instants; lateness is a wall-clock question, so compare in the company timezone.
        LocalTime actual = a.getCheckIn().atZoneSameInstant(zone()).toLocalTime();
        return actual.isAfter(start.plusMinutes(props.getAttendance().getLateGraceMinutes()));
    }

    private ZoneId zone() {
        return ZoneId.of(props.getTimezone());
    }
}
