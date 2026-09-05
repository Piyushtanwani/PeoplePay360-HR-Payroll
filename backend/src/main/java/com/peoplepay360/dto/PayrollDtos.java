package com.peoplepay360.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public class PayrollDtos {
    public record SalaryRuleDto(Long id, Long structureId, String name, String code, String category, int sequence,
                                String computeType, BigDecimal fixedAmount, BigDecimal percentage, String baseRuleCode,
                                String formula, boolean active, String description) {}
    public record SalaryStructureDto(Long id, String name, String code, boolean active, int ruleCount,
                                     long employeeCount, List<SalaryRuleDto> rules) {}
    public record SalaryStructureName(Long id, String name) {}
    public record SaveStructure(String name, String code, Boolean active) {}
    public record SaveRule(String name, String code, String category, Integer sequence, String computeType,
                           BigDecimal fixedAmount, BigDecimal percentage, String baseRuleCode, String formula,
                           Boolean active, String description) {}
    public record ReorderRules(List<Long> orderedRuleIds) {}
    public record DryRunRequest(List<Long> employeeIds, String period) {}
    public record DryRunResult(List<DryRunRow> results) {}
    public record DryRunRow(Long employeeId, String employeeName, BigDecimal currentNet, BigDecimal newNet, BigDecimal delta) {}

    public record EligibilityRequest(@NotNull Long structureId, @NotNull LocalDate periodStart, @NotNull LocalDate periodEnd) {}
    public record EligibleEmployee(Long employeeId, String employeeNo, String displayName, String departmentName,
                                   String contractReference, String contractStructureName, boolean eligible, String reason) {}
    public record CreatePayrun(String name, @NotNull Long structureId, @NotNull LocalDate periodStart,
                               @NotNull LocalDate periodEnd, @NotNull List<Long> employeeIds) {}
    public record UpdatePayrun(String name, List<Long> employeeIds) {}
    public record PayrunDto(Long id, String name, Long structureId, String structureName, LocalDate periodStart,
                            LocalDate periodEnd, String state, int employeeCount, int payslipCount,
                            BigDecimal totalNet, BigDecimal totalGross, long blockerCount, long warningCount,
                            Long createdBy, OffsetDateTime createdAt, OffsetDateTime computedAt,
                            OffsetDateTime validatedAt, OffsetDateTime paidAt, OffsetDateTime sentAt) {}
    public record PayrunIssueDto(Long id, Long payrunId, Long employeeId, String employeeName, String checkCode,
                                 String severity, boolean overridable, String message, String status,
                                 String overrideReason, String fixLink) {}
    public record OverrideRequest(String reason) {}
    public record PayInput(@NotNull Long employeeId, @NotNull String code, @NotNull BigDecimal value) {}
    public record PayStub(String status, OffsetDateTime sentAt, String recipient) {}
    public record PayslipLineDto(String ruleCode, String ruleName, String category, int sequence, BigDecimal amount) {}
    public record PayslipInputDto(String code, BigDecimal value, String source) {}
    public record PayslipDto(Long id, Long payrunId, String payrunName, String payrunState, Long employeeId,
                             String employeeName, String employeeNo, String departmentName, Long contractId,
                             String contractReference, LocalDate periodStart, LocalDate periodEnd,
                             BigDecimal workedDays, BigDecimal scheduledDays, BigDecimal unpaidDays,
                             BigDecimal basic, BigDecimal allowances, BigDecimal deductions, BigDecimal gross,
                             BigDecimal net, List<PayslipLineDto> lines, List<PayslipInputDto> inputs, PayStub delivery) {}
    public record PayRequest(LocalDate paymentDate, String note) {}
    public record SendResult(int queued, int skipped) {}
    public record DeliveryRow(Long payslipId, String employeeName, String status,
                              OffsetDateTime sentAt, String recipient) {}
    public record DeliveryReport(List<DeliveryRow> rows, java.util.Map<String, Long> summary) {}
    public record FormulaVariable(String name, String description) {}
    public record FormulaHelp(List<FormulaVariable> variables, List<String> functions, String example) {}
}
