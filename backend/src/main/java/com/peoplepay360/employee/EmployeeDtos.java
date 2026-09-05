package com.peoplepay360.employee;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public class EmployeeDtos {
    public record DepartmentDto(Long id, String name, long employeeCount) {}

    public record EmployeeSummary(Long id, String employeeNo, String displayName, String jobTitle,
                                  Long departmentId, String departmentName, String employeeType,
                                  Long managerId, String managerName, boolean active, String avatarColor) {}

    public record BankView(String bankName, String accountLast4, boolean hasAccount) {}

    public record EmployeeDetail(Long id, String employeeNo, String displayName, String jobTitle,
                                 Long departmentId, String departmentName, String employeeType,
                                 Long managerId, String managerName, boolean active, String avatarColor,
                                 String workEmail, LocalDate hireDate, Long userId,
                                 Long workingScheduleId, String workingScheduleName,
                                 Long activeContractId, BankView bankAccount, Counts counts) {}

    public record Counts(long contracts, long attendance, long timeOffRequests, long allocations) {}

    public record BankUnmasked(String bankName, String accountNumber, String ifsc) {}

    public record CreateEmployee(@NotBlank String displayName, Long departmentId, Long managerId,
                                 String employeeType, Long workingScheduleId, LocalDate hireDate,
                                 @Email String workEmail, String jobTitle) {}

    public record UpdateEmployee(String displayName, Long departmentId, Long managerId, String employeeType,
                                 Long workingScheduleId, LocalDate hireDate, String workEmail, String jobTitle,
                                 Boolean active) {}

    public record BankInput(@NotBlank String bankName, @NotBlank String accountNumber, String ifsc) {}

    public record CreateDepartment(@NotBlank String name) {}
}
