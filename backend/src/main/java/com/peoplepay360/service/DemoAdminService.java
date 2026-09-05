package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.config.AppProperties;
import com.peoplepay360.dto.IdentityDtos.LoginResponse;
import com.peoplepay360.dto.IdentityDtos.UserSummary;
import com.peoplepay360.model.AppUser;
import com.peoplepay360.repository.AppUserRepository;
import com.peoplepay360.repository.EffectivePermissionRepository;
import com.peoplepay360.security.JwtService;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Demo-profile utilities: reset the seed data, switch account without a password, and mint a delegated
 * token for demonstrating the assistant's tool calls.
 *
 * <p>Every method is gated on {@code seed.manage}, which only the administrator role holds and which is
 * never grantable, and the whole bean exists only under the demo profile.
 */
@Service
@Profile("demo")
public class DemoAdminService {
    /** Child-first order, so a truncate cascade never has to guess. */
    private static final List<String> TABLES = List.of(
            "chat_tool_call", "chat_message", "chat_session", "payslip_delivery", "payslip_line",
            "payslip", "payrun_input", "payrun_issue", "payrun_employee", "payrun", "salary_structure_version",
            "salary_rule", "salary_structure", "time_off_request", "time_off_allocation", "public_holiday",
            "time_off_type", "attendance_exception", "attendance", "contract", "contract_template",
            "employee_bank_account", "comparison_decision", "candidate_comparison", "candidate_identity",
            "candidate", "job_opening", "user_permission_grant", "password_setup_token", "ai_profile",
            "idempotency_record");

    private final AppUserRepository users;
    private final EffectivePermissionRepository effective;
    private final JwtService jwtService;
    private final AppProperties props;
    private final AuditService audit;
    private final JdbcTemplate jdbc;
    private final DemoSeeder seeder;

    public DemoAdminService(AppUserRepository users, EffectivePermissionRepository effective, JwtService jwtService,
                            AppProperties props, AuditService audit, JdbcTemplate jdbc, DemoSeeder seeder) {
        this.users = users;
        this.effective = effective;
        this.jwtService = jwtService;
        this.props = props;
        this.audit = audit;
        this.jdbc = jdbc;
        this.seeder = seeder;
    }

    @PreAuthorize("hasAuthority('seed.manage')")
    @Transactional(readOnly = true)
    public LoginResponse demoSwitch(String email) {
        AppUser u = users.findByEmailIgnoreCase(email).orElseThrow(() -> ApiException.notFound("user"));
        audit.record(Channel.SYSTEM, "DEMO_SWITCH", "user", u.getId().toString(), "ALLOW", u.getEmail(), null, null);
        return new LoginResponse(jwtService.mintBrowserToken(u), props.getJwt().getAccessTtlSeconds(), "Bearer",
                new UserSummary(u.getId(), u.getEmail(), u.getDisplayName(), u.getRole().getCode(),
                        u.getEmployeeId(), u.isActive()));
    }

    /** Empties every business table and reseeds. Demo profile only, and irreversible. */
    @PreAuthorize("hasAuthority('seed.manage')")
    @Transactional
    public Map<String, Object> reset() {
        for (String table : TABLES) {
            jdbc.execute("TRUNCATE TABLE " + table + " RESTART IDENTITY CASCADE");
        }
        jdbc.execute("DELETE FROM app_user");
        jdbc.execute("ALTER TABLE app_user ALTER COLUMN id RESTART WITH 1");
        jdbc.execute("TRUNCATE TABLE employee RESTART IDENTITY CASCADE");
        seeder.seed();
        audit.record(Channel.SYSTEM, "SEED_RESET", "system", null, "ALLOW", "demo data reset", null, null);
        return Map.of("status", "reseeded");
    }

    @PreAuthorize("hasAuthority('seed.manage')")
    @Transactional(readOnly = true)
    public Map<String, Object> debugToken(Long userId) {
        AppUser u = users.findById(userId).orElseThrow(() -> ApiException.notFound("user"));
        List<String> perms = effective.findCodesByUserId(userId);
        String token = jwtService.mintDelegatedToken(u, null, perms);
        audit.record(Channel.SYSTEM, "DEBUG_TOKEN", "user", userId.toString(), "ALLOW", "MCP demo token", null, null);
        return Map.of("token", token, "expiresIn", props.getJwt().getDelegatedTtlSeconds());
    }
}
