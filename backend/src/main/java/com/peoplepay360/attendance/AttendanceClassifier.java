package com.peoplepay360.attendance;

import com.peoplepay360.schedule.ScheduleService;
import com.peoplepay360.schedule.WorkingSchedule;
import org.springframework.stereotype.Component;

import java.time.Duration;

/** Classifies an attendance row against the schedule line for its weekday. */
@Component
public class AttendanceClassifier {
    private final ScheduleService scheduleService;
    public AttendanceClassifier(ScheduleService scheduleService) { this.scheduleService = scheduleService; }

    public void classify(Attendance a, WorkingSchedule schedule) {
        int scheduled = schedule == null ? 0 : scheduleService.minutesForDay(schedule, a.getWorkDate().getDayOfWeek().getValue());
        a.setScheduledMinutes(scheduled);
        if (a.getCheckIn() != null && a.getCheckOut() != null) {
            int worked = (int) Duration.between(a.getCheckIn(), a.getCheckOut()).toMinutes();
            a.setWorkedMinutes(Math.max(worked, 0));
            if (scheduled > 0 && worked > scheduled + 30) {
                a.setStatus("OVERTIME");
            } else {
                a.setStatus("PRESENT");
            }
        } else if (a.getCheckIn() != null) {
            a.setStatus("MISSING_CHECKOUT");
            a.setWorkedMinutes(0);
        }
    }

    public int overtimeMinutes(Attendance a) {
        if (!"OVERTIME".equals(a.getStatus())) return 0;
        return Math.max(0, a.getWorkedMinutes() - a.getScheduledMinutes());
    }
}
