package com.peoplepay360.dto;

import com.peoplepay360.dto.EmployeeDtos.EmployeeSummary;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.List;

public class IdentityDtos {
    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}
    public record UserSummary(Long id, String email, String displayName, String roleCode, Long employeeId, boolean active) {}
    public record LoginResponse(String accessToken, long expiresIn, String tokenType, UserSummary user) {}
    public record Settings(String currency, String timezone, String appName, String profile) {}
    public record Features(boolean chat, boolean recruitment) {}
    public record MeResponse(UserSummary user, List<String> permissions, EmployeeSummary employee,
                             Settings settings, Features features) {}

    public record CreateUser(@Email @NotBlank String email, @NotBlank String displayName, String password,
                             @NotBlank String roleCode, Long employeeId, Boolean active,
                             /** Email a set-password link instead of assigning a password here. */
                             Boolean sendInvite) {}
    public record CreateUserResult(UserDetail user, boolean inviteSent, String inviteMessage) {}
    public record SetPasswordRequest(String token, String password) {}
    public record ForgotPasswordRequest(@Email @NotBlank String email) {}
    /** Employees with no login yet, offered when creating a user. */
    public record InvitableEmployee(Long employeeId, String employeeNo, String displayName, String workEmail,
                                    String jobTitle, String departmentName) {}
    public record UpdateUser(String displayName, String password, Long employeeId, Boolean active) {}
    public record RoleAssign(@NotBlank String roleCode) {}
    public record UserDetail(Long id, String email, String displayName, String roleCode, Long employeeId,
                             boolean active, int grantCount) {}
    public record PermissionCatalogueEntry(String code, String resource, String action, String scope,
                                           String tier, String description, boolean grantableByMe) {}
    public record GrantDto(Long id, Long userId, String permissionCode, String effect, String reason,
                           Long grantedBy, String grantedByName, OffsetDateTime grantedAt,
                           OffsetDateTime expiresAt, OffsetDateTime revokedAt, boolean active) {}
    public record CreateGrant(@NotBlank String permissionCode, String effect, @NotBlank String reason,
                              OffsetDateTime expiresAt) {}
    public record UserPermissions(List<String> effective, List<String> fromRole, List<GrantDto> grants) {}

    // ---- self service ------------------------------------------------------
    /** What a signed-in person may see and change about themselves. */
    public record MyProfile(UserSummary user, com.peoplepay360.dto.EmployeeDtos.EmployeeDetail employee,
                            String passwordRule) {}
    public record UpdateMyProfile(@NotBlank String displayName) {}
    /**
     * @param currentPassword required: changing where wages are paid is the fraud path the self-action
     *                        guard exists for, so it is re-authenticated rather than merely logged in.
     */
    public record UpdateMyBank(@NotBlank String bankName, @NotBlank String accountNumber, String ifsc,
                               @NotBlank String currentPassword) {}
    public record ChangePassword(@NotBlank String currentPassword, @NotBlank String newPassword) {}
}
