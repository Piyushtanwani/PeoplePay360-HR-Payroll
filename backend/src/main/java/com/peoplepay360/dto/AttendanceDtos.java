package com.peoplepay360.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;

public class AttendanceDtos {
    public record AttendanceDto(Long id, Long employeeId, String employeeName, LocalDate workDate,
                                OffsetDateTime checkIn, OffsetDateTime checkOut, int workedMinutes,
                                int scheduledMinutes, String status, boolean isManualEdit,
                                Long editedBy, String editReason) {}

    /**
     * @param scheduledEnd the employee's scheduled finish time for that date, so the resolve panel can
     *                     offer "set check-out to the scheduled end" as a real value rather than a guess.
     */
    public record ExceptionDto(Long id, Long employeeId, String employeeName, LocalDate date, String type,
                               int minutes, boolean resolved, Long attendanceId, LocalTime scheduledEnd,
                               Long resolvedBy, OffsetDateTime resolvedAt, String resolutionNote) {}

    public record TodayView(AttendanceDto openAttendance, List<AttendanceDto> todayRows) {}

    public record CorrectRequest(OffsetDateTime checkIn, OffsetDateTime checkOut,
                                 @NotBlank(message = "A correction reason is required.") String editReason) {}

    public record ManualRequest(@NotNull Long employeeId, LocalDate workDate,
                                OffsetDateTime checkIn, OffsetDateTime checkOut) {}

    /**
     * @param checkOut optional; only meaningful for a missing check-out, where it closes the entry.
     * @param reason   always required: a resolved exception must say why it was acceptable.
     */
    public record ResolveRequest(OffsetDateTime checkOut,
                                 @NotBlank(message = "A resolution reason is required.") String reason) {}

    /**
     * The rules the classifier actually applies, read from configuration rather than restated in prose,
     * so the in-app help panel can never drift from the behaviour it documents.
     */
    public record AttendanceRules(int lateGraceMinutes, int overtimeThresholdMinutes,
                                  int missingCheckoutAfterMinutes, String timezone,
                                  List<RuleExplanation> statuses, List<RuleExplanation> edgeCases) {}

    public record RuleExplanation(String key, String title, String detail) {}
}
