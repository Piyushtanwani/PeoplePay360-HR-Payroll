package com.peoplepay360.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

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

    /** A reusable set of terms. Applying one to an employee creates and activates a real contract. */
    public record ContractTemplateDto(Long id, String name, BigDecimal wage, String wageType,
                                      Long workingScheduleId, String workingScheduleName,
                                      Long salaryStructureId, String salaryStructureName,
                                      String jobTitle, String description, boolean active,
                                      OffsetDateTime createdAt) {}

    public record SaveContractTemplate(@NotBlank String name, @NotNull @Positive BigDecimal wage, String wageType,
                                       Long workingScheduleId, Long salaryStructureId, String jobTitle,
                                       String description, Boolean active) {}
}
