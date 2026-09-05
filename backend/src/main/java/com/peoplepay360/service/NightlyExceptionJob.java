package com.peoplepay360.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Nightly attendance sweep: flags entries nobody closed, then records yesterday's absences.
 *
 * <p>Deliberately thin. Both steps live in {@link AttendanceService} so the recompute endpoint runs
 * exactly the same code, and the scheduled and on-demand paths cannot drift apart.
 */
@Component
public class NightlyExceptionJob {
    private static final Logger log = LoggerFactory.getLogger(NightlyExceptionJob.class);
    private final AttendanceService attendanceService;
    private final com.peoplepay360.config.AppProperties props;

    public NightlyExceptionJob(AttendanceService attendanceService, com.peoplepay360.config.AppProperties props) {
        this.attendanceService = attendanceService;
        this.props = props;
    }

    @Scheduled(cron = "0 0 2 * * *", zone = "${app.timezone:Asia/Kolkata}")
    public void run() {
        LocalDate today = LocalDate.now(ZoneId.of(props.getTimezone()));
        int flagged = attendanceService.flagMissingCheckouts(today);
        int absences = attendanceService.buildAbsences(today.minusDays(1));
        log.info("Nightly attendance sweep: {} missing check-out(s) flagged, {} absence(s) recorded.",
                flagged, absences);
    }
}
