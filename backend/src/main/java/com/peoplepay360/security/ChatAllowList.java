package com.peoplepay360.security;

import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import java.util.List;

/** GET-only endpoints reachable by a delegated chat token. Mirrors Part B9 and the MCP tool catalogue. */
@Component
public class ChatAllowList {
    public static final List<String> PATTERNS = List.of(
            "/api/auth/me",
            "/api/employees",
            "/api/employees/*/summary",
            "/api/contracts",
            "/api/timeoff/balances",
            "/api/timeoff/requests",
            "/api/attendance/exceptions",
            "/api/payruns",
            "/api/payruns/*/issues",
            "/api/payslips",
            "/api/payslips/*",
            "/api/reports/dashboard",
            "/api/recruitment/openings/*/comparison"
    );
    private final AntPathMatcher matcher = new AntPathMatcher();

    public boolean allows(String path) {
        return PATTERNS.stream().anyMatch(p -> matcher.match(p, path));
    }
}
