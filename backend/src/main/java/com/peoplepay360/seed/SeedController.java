package com.peoplepay360.seed;

import com.peoplepay360.ai.McpClient;
import com.peoplepay360.identity.AppUser;
import com.peoplepay360.identity.AppUserRepository;
import com.peoplepay360.identity.EffectivePermissionRepository;
import com.peoplepay360.identity.IdentityDtos.LoginResponse;
import com.peoplepay360.identity.IdentityDtos.UserSummary;
import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.config.AppProperties;
import com.peoplepay360.security.JwtService;
import jakarta.transaction.Transactional;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Demo-profile utilities: reset seed data, fast account switch, and a delegated token for MCP demonstrations. */
@RestController
@Profile("demo")
public class SeedController {
    private final AppUserRepository users;
    private final EffectivePermissionRepository effective;
    private final JwtService jwtService;
    private final AppProperties props;
    private final AuditService audit;
    private final JdbcTemplate jdbc;
    private final DemoSeeder seeder;
    private final McpClient mcp;

    public SeedController(AppUserRepository users, EffectivePermissionRepository effective, JwtService jwtService,
                         AppProperties props, AuditService audit, JdbcTemplate jdbc, DemoSeeder seeder, McpClient mcp) {
        this.users = users;
        this.effective = effective;
        this.jwtService = jwtService;
        this.props = props;
        this.audit = audit;
        this.jdbc = jdbc;
        this.seeder = seeder;
        this.mcp = mcp;
    }

    @PostMapping("/api/auth/demo-switch")
    @PreAuthorize("hasAuthority('seed.manage')")
    public LoginResponse demoSwitch(@RequestBody Map<String, String> body) {
        AppUser u = users.findByEmailIgnoreCase(body.get("email"))
                .orElseThrow(() -> ApiException.notFound("user"));
        audit.record(Channel.SYSTEM, "DEMO_SWITCH", "user", u.getId().toString(), "ALLOW", u.getEmail(), null, null);
        String token = jwtService.mintBrowserToken(u);
        return new LoginResponse(token, props.getJwt().getAccessTtlSeconds(), "Bearer",
                new UserSummary(u.getId(), u.getEmail(), u.getDisplayName(), u.getRole().getCode(),
                        u.getEmployeeId(), u.isActive()));
    }

    @PostMapping("/api/admin/seed/reset")
    @PreAuthorize("hasAuthority('seed.manage')")
    @Transactional
    public Map<String, Object> reset() {
        String[] tables = {
                "chat_tool_call", "chat_message", "chat_session", "payslip_delivery", "payslip_line",
                "payslip", "payrun_input", "payrun_issue", "payrun_employee", "payrun", "salary_structure_version",
                "salary_rule", "salary_structure", "time_off_request", "time_off_allocation", "public_holiday",
                "time_off_type", "attendance_exception", "attendance", "contract", "employee_bank_account",
                "comparison_decision", "candidate_comparison", "candidate_identity", "candidate", "job_opening",
                "user_permission_grant", "ai_profile", "idempotency_record"
        };
        for (String t : tables) jdbc.execute("TRUNCATE TABLE " + t + " RESTART IDENTITY CASCADE");
        jdbc.execute("DELETE FROM app_user");
        jdbc.execute("ALTER TABLE app_user ALTER COLUMN id RESTART WITH 1");
        jdbc.execute("TRUNCATE TABLE employee RESTART IDENTITY CASCADE");
        seeder.seed();
        audit.record(Channel.SYSTEM, "SEED_RESET", "system", null, "ALLOW", "demo data reset", null, null);
        return Map.of("status", "reseeded");
    }

    @PostMapping("/api/admin/chat/debug-token")
    @PreAuthorize("hasAuthority('seed.manage')")
    public Map<String, Object> debugToken(@RequestBody Map<String, Object> body) {
        Long userId = ((Number) body.get("userId")).longValue();
        AppUser u = users.findById(userId).orElseThrow(() -> ApiException.notFound("user"));
        List<String> perms = effective.findCodesByUserId(userId);
        String token = jwtService.mintDelegatedToken(u, null, perms);
        audit.record(Channel.SYSTEM, "DEBUG_TOKEN", "user", userId.toString(), "ALLOW", "MCP demo token", null, null);
        return Map.of("token", token, "expiresIn", props.getJwt().getDelegatedTtlSeconds());
    }
}
