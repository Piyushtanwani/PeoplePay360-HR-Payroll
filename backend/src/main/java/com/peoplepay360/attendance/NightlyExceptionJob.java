package com.peoplepay360.attendance;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Recreates ABSENT and MISSING_CHECKOUT exceptions for scheduled working days. Runs at 02:00 in the app timezone.
 * The heavy classification also runs on demand via the recompute endpoint.
 */
@Component
public class NightlyExceptionJob {
    private static final Logger log = LoggerFactory.getLogger(NightlyExceptionJob.class);
    private final AttendanceExceptionRepository exceptions;
    private final AttendanceRepository attendance;

    public NightlyExceptionJob(AttendanceExceptionRepository exceptions, AttendanceRepository attendance) {
        this.exceptions = exceptions;
        this.attendance = attendance;
    }

    @Scheduled(cron = "0 0 2 * * *", zone = "${app.timezone:Asia/Kolkata}")
    public void run() {
        // Rebuild MISSING_CHECKOUT exceptions from open attendance rows without duplicates.
        attendance.findAll().stream()
                .filter(a -> a.getCheckOut() == null && a.getCheckIn() != null)
                .forEach(a -> {
                    if (exceptions.findByAttendanceId(a.getId()).isEmpty()) {
                        AttendanceException ex = new AttendanceException();
                        ex.setEmployeeId(a.getEmployeeId());
                        ex.setAttendanceId(a.getId());
                        ex.setDate(a.getWorkDate());
                        ex.setType("MISSING_CHECKOUT");
                        ex.setMinutes(0);
                        exceptions.save(ex);
                    }
                });
        log.info("Nightly attendance exception job completed.");
    }
}
