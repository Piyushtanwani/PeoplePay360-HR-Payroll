package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.dto.EmployeeDtos.BankInput;
import com.peoplepay360.dto.EmployeeDtos.EmployeeDetail;
import com.peoplepay360.dto.IdentityDtos.ChangePassword;
import com.peoplepay360.dto.IdentityDtos.MyProfile;
import com.peoplepay360.dto.IdentityDtos.UpdateMyBank;
import com.peoplepay360.dto.IdentityDtos.UpdateMyProfile;
import com.peoplepay360.dto.IdentityDtos.UserSummary;
import com.peoplepay360.model.AppUser;
import com.peoplepay360.model.Employee;
import com.peoplepay360.repository.AppUserRepository;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.security.CurrentUser;
import com.peoplepay360.security.LoginRateLimiter;
import com.peoplepay360.security.PasswordPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What a signed-in person may do to their own record, without needing an administrator.
 *
 * <p>No permission annotations: every authenticated account owns exactly one of these, and the scope is
 * always the caller. Employee-bound actions fail clearly when the account has no employee behind it.
 */
@Service
public class SelfServiceService {
    private final AppUserRepository users;
    private final EmployeeRepository employees;
    private final EmployeeService employeeService;
    private final UserInviteService invites;
    private final PasswordEncoder encoder;
    private final CurrentUser currentUser;
    private final LoginRateLimiter rateLimiter;
    private final AuditService audit;

    public SelfServiceService(AppUserRepository users, EmployeeRepository employees,
                              EmployeeService employeeService, UserInviteService invites,
                              PasswordEncoder encoder, CurrentUser currentUser,
                              LoginRateLimiter rateLimiter, AuditService audit) {
        this.users = users;
        this.employees = employees;
        this.employeeService = employeeService;
        this.invites = invites;
        this.encoder = encoder;
        this.currentUser = currentUser;
        this.rateLimiter = rateLimiter;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public MyProfile profile() {
        AppUser u = requireUser();
        EmployeeDetail employee = u.getEmployeeId() == null ? null : employeeService.detailForSelf(u.getEmployeeId());
        return new MyProfile(toSummary(u), employee, PasswordPolicy.describe());
    }

    /**
     * Updates the display name on both the login and the employee record, so the name in the header and
     * the name on a payslip cannot disagree.
     */
    @Transactional
    public MyProfile updateProfile(UpdateMyProfile in) {
        AppUser u = requireUser();
        String name = in.displayName().trim();
        if (name.isEmpty()) throw ApiException.validation("A display name is required.");
        String before = u.getDisplayName();
        u.setDisplayName(name);
        if (u.getEmployeeId() != null) {
            employees.findById(u.getEmployeeId()).ifPresent(e -> e.setDisplayName(name));
        }
        audit.record(Channel.UI, "UPDATE_OWN_PROFILE", "user", u.getId().toString(), "ALLOW",
                null, before, name);
        return profile();
    }

    /**
     * Changes where the caller's own wages are paid.
     *
     * <p>HR is blocked from editing their own bank details by the self-action guard, so this is the only
     * route, and it is deliberately narrow: the current password is re-checked, and the change is audited
     * with the old and new last four digits.
     */
    @Transactional
    public EmployeeDetail updateBankAccount(UpdateMyBank in) {
        AppUser u = requireUser();
        Long employeeId = requireEmployeeId(u);
        assertPassword(u, in.currentPassword());
        Employee e = employees.findById(employeeId).orElseThrow(() -> ApiException.notFound("employee"));
        employeeService.writeBankAccount(employeeId, new BankInput(in.bankName(), in.accountNumber(), in.ifsc()),
                "SET_OWN_BANK");
        return employeeService.detailForSelf(e.getId());
    }

    /**
     * Changes the caller's own password.
     *
     * <p>A wrong current password is a validation error, not a 401: a 401 would make the browser treat
     * the session as expired and sign the person out mid-form.
     */
    @Transactional
    public void changePassword(ChangePassword in, String ip) {
        AppUser u = requireUser();
        if (!rateLimiter.tryConsume(u.getEmail(), ip == null ? "unknown" : ip)) {
            throw new ApiException(com.peoplepay360.common.ErrorCode.RATE_LIMITED,
                    "Too many attempts. Please wait and try again.");
        }
        assertPassword(u, in.currentPassword());
        if (in.currentPassword().equals(in.newPassword())) {
            throw ApiException.validation("The new password must be different from the current one.");
        }
        PasswordPolicy.validate(in.newPassword(), u.getEmail());
        u.setPasswordHash(encoder.encode(in.newPassword()));
        users.save(u);
        // Any invite or reset link already in an inbox must stop working now.
        invites.invalidateOutstanding(u.getId());
        audit.record(Channel.UI, "CHANGE_OWN_PASSWORD", "user", u.getId().toString(), "ALLOW", null, null, null);
    }

    private void assertPassword(AppUser u, String candidate) {
        if (candidate == null || !encoder.matches(candidate, u.getPasswordHash())) {
            audit.deny(Channel.UI, "SELF_REAUTH", "user", u.getId().toString(), "wrong current password");
            throw ApiException.validation("That is not your current password.");
        }
    }

    private AppUser requireUser() {
        return users.findById(currentUser.userId()).orElseThrow(() -> ApiException.notFound("user"));
    }

    private Long requireEmployeeId(AppUser u) {
        if (u.getEmployeeId() == null) {
            throw ApiException.illegalState(
                    "Your account is not linked to an employee record, so there are no employment details to change.");
        }
        return u.getEmployeeId();
    }

    private UserSummary toSummary(AppUser u) {
        return new UserSummary(u.getId(), u.getEmail(), u.getDisplayName(), u.getRole().getCode(),
                u.getEmployeeId(), u.isActive());
    }
}
