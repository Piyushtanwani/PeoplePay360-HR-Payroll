package com.peoplepay360.security;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.List;

/** Reads the authenticated principal from the security context and exposes typed accessors. */
@Component
public class CurrentUser {

    public AuthPrincipal get() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !(a.getPrincipal() instanceof Jwt jwt)) {
            throw new ApiException(ErrorCode.UNAUTHENTICATED, "Not authenticated");
        }
        Long userId = Long.valueOf(jwt.getSubject());
        Long emp = jwt.getClaim("emp") == null ? null : ((Number) jwt.getClaim("emp")).longValue();
        boolean chat = "chat".equals(jwt.getClaimAsString("act"));
        Integer permVersion = jwt.getClaim("permVersion") == null ? null
                : ((Number) jwt.getClaim("permVersion")).intValue();
        String roleCode = null;
        List<String> roles = jwt.getClaimAsStringList("roles");
        if (roles != null && !roles.isEmpty()) roleCode = roles.get(0);
        return new AuthPrincipal(userId, emp, roleCode, chat, permVersion, jwt.getClaimAsString("name"));
    }

    public Long userId() { return get().userId(); }
    public Long employeeId() { return get().employeeId(); }

    public boolean hasAuthority(String code) {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getAuthorities().stream().anyMatch(x -> x.getAuthority().equals(code));
    }
    public boolean canSeeRequiredPermission() {
        return hasAuthority("user.read") || hasAuthority("audit.read");
    }
}
