package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.config.AppProperties;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.service.EmployeeService;
import com.peoplepay360.dto.IdentityDtos.*;
import com.peoplepay360.security.CurrentUser;
import com.peoplepay360.security.JwtService;
import com.peoplepay360.security.LoginRateLimiter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import com.peoplepay360.model.AppUser;
import com.peoplepay360.repository.AppUserRepository;
import com.peoplepay360.repository.EffectivePermissionRepository;

@Service
public class AuthService {
    private final AppUserRepository users;
    private final EffectivePermissionRepository effective;
    private final EmployeeRepository employees;
    private final EmployeeService employeeService;
    private final PasswordEncoder encoder;
    private final JwtService jwtService;
    private final LoginRateLimiter rateLimiter;
    private final AuditService audit;
    private final CurrentUser currentUser;
    private final AppProperties props;
    @Value("${spring.profiles.active:dev}") private String activeProfile;

    public AuthService(AppUserRepository users, EffectivePermissionRepository effective,
                       EmployeeRepository employees, EmployeeService employeeService, PasswordEncoder encoder,
                       JwtService jwtService, LoginRateLimiter rateLimiter, AuditService audit,
                       CurrentUser currentUser, AppProperties props) {
        this.users = users;
        this.effective = effective;
        this.employees = employees;
        this.employeeService = employeeService;
        this.encoder = encoder;
        this.jwtService = jwtService;
        this.rateLimiter = rateLimiter;
        this.audit = audit;
        this.currentUser = currentUser;
        this.props = props;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest in, String ip) {
        if (!rateLimiter.tryConsume(in.email(), ip == null ? "unknown" : ip)) {
            throw new ApiException(ErrorCode.RATE_LIMITED, "Too many login attempts. Please wait and try again.");
        }
        AppUser user = users.findByEmailIgnoreCase(in.email()).orElse(null);
        if (user == null || !user.isActive() || !encoder.matches(in.password(), user.getPasswordHash())) {
            audit.record(Channel.UI, "LOGIN", "user", user == null ? null : user.getId().toString(),
                    "DENY", "invalid credentials", null, null);
            throw new ApiException(ErrorCode.UNAUTHENTICATED, "Invalid email or password.");
        }
        String token = jwtService.mintBrowserToken(user);
        audit.record(Channel.UI, "LOGIN", "user", user.getId().toString(), "ALLOW", null, null, null);
        return new LoginResponse(token, props.getJwt().getAccessTtlSeconds(), "Bearer", toSummary(user));
    }

    @Transactional(readOnly = true)
    public MeResponse me() {
        AppUser user = users.findById(currentUser.userId()).orElseThrow(() -> ApiException.notFound("user"));
        List<String> perms = effective.findCodesByUserId(user.getId());
        var empSummary = user.getEmployeeId() == null ? null :
                employees.findById(user.getEmployeeId()).map(employeeService::toSummary).orElse(null);
        Settings settings = new Settings(props.getCurrency(), props.getTimezone(), "PeoplePay360", activeProfile);
        Features features = new Features(perms.contains("chat.access"), perms.contains("candidate.read"));
        return new MeResponse(toSummary(user), perms, empSummary, settings, features);
    }

    public UserSummary toSummary(AppUser u) {
        return new UserSummary(u.getId(), u.getEmail(), u.getDisplayName(), u.getRole().getCode(),
                u.getEmployeeId(), u.isActive());
    }
}
