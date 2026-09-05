package com.peoplepay360.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDate;

public class EmployeeDtos {
    public record DepartmentDto(Long id, String name, long employeeCount) {}

    public record EmployeeSummary(Long id, String employeeNo, String displayName, String jobTitle,
                                  Long departmentId, String departmentName, String employeeType,
                                  Long managerId, String managerName, boolean active, String avatarColor,
                                  Counts counts) {}

    public record BankView(String bankName, String accountLast4, boolean hasAccount) {}

    /**
     * @param roleCode the role on the employee's login, or null when they have none.
     * @param onboarding populated only by the create response; null on every read.
     */
    public record EmployeeDetail(Long id, String employeeNo, String displayName, String jobTitle,
                                 Long departmentId, String departmentName, String employeeType,
                                 Long managerId, String managerName, boolean active, String avatarColor,
                                 String workEmail, LocalDate hireDate, Long userId, String roleCode,
                                 Long workingScheduleId, String workingScheduleName,
                                 Long activeContractId, BankView bankAccount, Counts counts,
                                 OnboardingOutcome onboarding) {}

    public record Counts(long contracts, long attendance, long timeOffRequests, long allocations) {}

    public record BankUnmasked(String bankName, String accountNumber, String ifsc) {}

    /**
     * @param roleCode           when given, a login is created for the employee and an invite emailed.
     *                           Requires the caller to hold user.create, and a work email to send to.
     * @param contractTemplateId when given, a running contract is created from that template.
     * @param wage               overrides the template wage for this employee only.
     * @param contractStartDate  defaults to the hire date.
     */
    public record CreateEmployee(@NotBlank String displayName, Long departmentId, Long managerId,
                                 String employeeType, Long workingScheduleId, LocalDate hireDate,
                                 @Email String workEmail, String jobTitle,
                                 String roleCode, Long contractTemplateId, BigDecimal wage,
                                 LocalDate contractStartDate) {}

    /** @param roleCode reassigns the role on the employee's existing login. */
    public record UpdateEmployee(String displayName, Long departmentId, Long managerId, String employeeType,
                                 Long workingScheduleId, LocalDate hireDate, String workEmail, String jobTitle,
                                 Boolean active, String roleCode) {}

    /** Creating a login for an employee who was onboarded without one. */
    public record CreateLogin(@NotBlank String roleCode) {}

    /**
     * What happened to the login and contract that creating an employee may also create, so the
     * interface can say so instead of the caller guessing.
     */
    public record OnboardingOutcome(Long userId, boolean inviteSent, String inviteMessage,
                                    Long contractId, String contractReference) {}

    public record BankInput(@NotBlank String bankName, @NotBlank String accountNumber, String ifsc) {}

    public record CreateDepartment(@NotBlank String name) {}
}
