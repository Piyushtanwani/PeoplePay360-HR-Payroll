package com.peoplepay360.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public class AttendanceDtos {
    public record AttendanceDto(Long id, Long employeeId, String employeeName, LocalDate workDate,
                                OffsetDateTime checkIn, OffsetDateTime checkOut, int workedMinutes,
                                int scheduledMinutes, String status, boolean isManualEdit,
                                Long editedBy, String editReason) {}
    public record ExceptionDto(Long id, Long employeeId, String employeeName, LocalDate date, String type,
                               int minutes, boolean resolved, Long attendanceId) {}
    public record TodayView(AttendanceDto openAttendance, List<AttendanceDto> todayRows) {}
    public record CorrectRequest(OffsetDateTime checkIn, OffsetDateTime checkOut, String editReason) {}
    public record ManualRequest(Long employeeId, LocalDate workDate, OffsetDateTime checkIn, OffsetDateTime checkOut) {}
    public record ResolveRequest(OffsetDateTime checkOut, String reason) {}
}
