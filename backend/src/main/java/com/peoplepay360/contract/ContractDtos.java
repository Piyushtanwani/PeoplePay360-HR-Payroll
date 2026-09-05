package com.peoplepay360.contract;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

public class ContractDtos {
    public record ContractDto(Long id, Long employeeId, String employeeName, String reference,
                              BigDecimal wage, String wageType, LocalDate startDate, LocalDate endDate,
                              String state, Long workingScheduleId, String workingScheduleName,
                              Long salaryStructureId, String salaryStructureName, String jobTitle,
                              Long departmentId, boolean isActiveNow, long version) {}

    public record CreateContract(@NotNull Long employeeId, @NotNull @Positive BigDecimal wage, String wageType,
                                 @NotNull LocalDate startDate, LocalDate endDate, Long workingScheduleId,
                                 Long salaryStructureId, String jobTitle, Long departmentId) {}

    public record UpdateContract(BigDecimal wage, String wageType, LocalDate startDate, LocalDate endDate,
                                 Long workingScheduleId, Long salaryStructureId, String jobTitle, Long departmentId) {}
}
