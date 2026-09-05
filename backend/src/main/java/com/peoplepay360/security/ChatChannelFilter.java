package com.peoplepay360.security;

import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.repository.AppUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Confines any request carrying a delegated chat token (act=chat) to GET on the allow-list, with a fresh permVersion.
 * These rules hold independently of method security, so the backend can never execute a write for the model.
 */
@Component
public class ChatChannelFilter extends OncePerRequestFilter {
    private final ChatAllowList allowList;
    private final AppUserRepository users;
    private final AuditService audit;

    public ChatChannelFilter(ChatAllowList allowList, AppUserRepository users, AuditService audit) {
        this.allowList = allowList;
        this.users = users;
        this.audit = audit;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !(a.getPrincipal() instanceof Jwt jwt) || !"chat".equals(jwt.getClaimAsString("act"))) {
            chain.doFilter(req, res);
            return;
        }
        String path = req.getRequestURI();
        String rt = resourceType(path);
        String rid = resourceId(path);

        if (!"GET".equalsIgnoreCase(req.getMethod())) {
            audit.deny(Channel.CHAT, req.getMethod() + " " + path, rt, rid, "chat token cannot write");
            ProblemWriter.write(res, ErrorCode.PERMISSION_DENIED, "The assistant cannot perform this action.");
            return;
        }
        if (!allowList.allows(path)) {
            audit.deny(Channel.CHAT, "GET " + path, rt, rid, "path not on chat allow-list");
            ProblemWriter.write(res, ErrorCode.PERMISSION_DENIED, "The assistant cannot access this resource.");
            return;
        }
        Integer tokenVersion = jwt.getClaim("permVersion") == null ? null
                : ((Number) jwt.getClaim("permVersion")).intValue();
        Long userId = Long.valueOf(jwt.getSubject());
        Integer current = users.findById(userId).map(u -> u.getPermVersion()).orElse(null);
        if (tokenVersion == null || current == null || !tokenVersion.equals(current)) {
            audit.deny(Channel.CHAT, "GET " + path, rt, rid, "stale permission version");
            ProblemWriter.write(res, ErrorCode.TOKEN_STALE, "Your access has changed. Please retry.");
            return;
        }
        chain.doFilter(req, res);
        if (res.getStatus() < 400) {
            audit.allow(Channel.CHAT, "GET " + path, rt, rid);
        }
    }

    private String resourceType(String path) {
        if (path.contains("/payslips")) return "payslip";
        if (path.contains("/payruns")) return "payrun";
        if (path.contains("/employees")) return "employee";
        if (path.contains("/contracts")) return "contract";
        if (path.contains("/attendance")) return "attendance";
        if (path.contains("/timeoff")) return "timeoff";
        if (path.contains("/reports")) return "dashboard";
        if (path.contains("/recruitment")) return "candidate";
        return "unknown";
    }
    private String resourceId(String path) {
        String[] parts = path.split("/");
        for (int i = parts.length - 1; i >= 0; i--) {
            if (parts[i].matches("\\d+")) return parts[i];
        }
        return null;
    }
}
