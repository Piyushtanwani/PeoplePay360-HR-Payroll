package com.peoplepay360.security;

import com.peoplepay360.common.PermissionDeniedException;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import org.springframework.stereotype.Component;

/** Narrows list queries to the caller's own employee id when the caller lacks the .all scope. */
@Component
public class ScopeResolver {
    private final CurrentUser currentUser;
    private final AuditService audit;
    public ScopeResolver(CurrentUser currentUser, AuditService audit) {
        this.currentUser = currentUser;
        this.audit = audit;
    }

    /**
     * Returns the employee id to filter by, or null when the caller holds the .all scope (no filter).
     * A requested id that differs from the caller's own id (for a .own-only caller) is refused with 403.
     */
    public Long resolveEmployeeFilter(String allAuthority, Long requestedEmployeeId) {
        if (currentUser.hasAuthority(allAuthority)) return requestedEmployeeId;
        Long own = currentUser.employeeId();
        if (requestedEmployeeId != null && !requestedEmployeeId.equals(own)) {
            audit.deny(Channel.UI, "LIST", "scope", requestedEmployeeId.toString(), "scope mismatch");
            throw new PermissionDeniedException(allAuthority);
        }
        return own;
    }
}
