package com.peoplepay360.schedule;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

public class ScheduleDtos {
    public record LineDto(int dayOfWeek, LocalTime startTime, LocalTime endTime, int breakMinutes) {}
    public record ScheduleDto(Long id, String name, String type, BigDecimal weeklyHours, List<LineDto> lines) {}
    public record ScheduleName(Long id, String name, BigDecimal weeklyHours) {}
    public record SaveSchedule(@NotBlank String name, String type, List<LineDto> lines) {}
}
