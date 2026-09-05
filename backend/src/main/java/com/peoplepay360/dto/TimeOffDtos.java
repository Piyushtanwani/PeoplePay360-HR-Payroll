package com.peoplepay360.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public class TimeOffDtos {
    public record TypeDto(Long id, String name, String code, String unit, boolean isPaid,
                          boolean requiresAllocation, String color, boolean active) {}
    public record SaveType(@jakarta.validation.constraints.NotBlank String name,
                           @jakarta.validation.constraints.NotBlank String code,
                           Boolean isPaid, Boolean requiresAllocation, String color, Boolean active) {}
    public record AllocationDto(Long id, Long employeeId, String employeeName, Long typeId, String typeName,
                                BigDecimal days, BigDecimal taken, BigDecimal remaining,
                                LocalDate validFrom, LocalDate validTo, String state,
                                Long approvedBy, OffsetDateTime approvedAt, String note) {}
    public record CreateAllocation(@NotNull Long employeeId, @NotNull Long typeId, @NotNull BigDecimal days,
                                   LocalDate validFrom, LocalDate validTo, String note) {}
    public record RequestDto(Long id, Long employeeId, String employeeName, Long typeId, String typeName,
                             LocalDate startDate, LocalDate endDate, BigDecimal days, String state, String reason,
                             String anomaly, Long decidedBy, OffsetDateTime decidedAt, String decisionNote) {}
    public record CreateRequest(Long employeeId, @NotNull Long typeId, @NotNull LocalDate startDate,
                                @NotNull LocalDate endDate, String reason) {}
    public record SimulateRequest(@NotNull Long typeId, @NotNull LocalDate startDate, @NotNull LocalDate endDate, Long employeeId) {}
    public record SimulateResult(BigDecimal days, BigDecimal available, BigDecimal projectedAfter, String anomaly) {}
    public record Decision(String note, Boolean force) {}
    public record LeaveBalance(Long employeeId, Long typeId, String typeName, BigDecimal allocated,
                               BigDecimal taken, BigDecimal pending, BigDecimal available, BigDecimal projected) {}
    public record HolidayDto(Long id, LocalDate date, String name) {}
    public record SaveHoliday(@NotNull LocalDate date,
                              @jakarta.validation.constraints.NotBlank String name) {}
}
