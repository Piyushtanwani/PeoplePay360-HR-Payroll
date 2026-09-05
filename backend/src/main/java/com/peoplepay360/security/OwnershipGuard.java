package com.peoplepay360.security;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import org.springframework.stereotype.Component;

/**
 * Ownership check for .own read-by-id and sub-resource paths. When the caller lacks the .all scope and the row is
 * not theirs, the response is 404 (uniform with not-found, so there is no existence oracle) plus a DENY audit row.
 */
@Component
public class OwnershipGuard {
    private final CurrentUser currentUser;
    private final AuditService audit;
    public OwnershipGuard(CurrentUser currentUser, AuditService audit) {
        this.currentUser = currentUser;
        this.audit = audit;
    }

    public void requireOwnedOr404(Long ownerEmployeeId, String allAuthority, String resourceType, Object resourceId) {
        if (currentUser.hasAuthority(allAuthority)) return;
        Long own = currentUser.employeeId();
        if (own != null && own.equals(ownerEmployeeId)) return;
        audit.deny(Channel.UI, "READ", resourceType, resourceId == null ? null : resourceId.toString(), "not owner");
        throw ApiException.notFound(resourceType);
    }

    /** For chat-session ownership; caller with chat.admin bypasses. */
    public void requireOwnUserOr404(Long ownerUserId, String adminAuthority, String resourceType, Object resourceId) {
        if (adminAuthority != null && currentUser.hasAuthority(adminAuthority)) return;
        if (ownerUserId != null && ownerUserId.equals(currentUser.userId())) return;
        audit.deny(Channel.UI, "READ", resourceType, resourceId == null ? null : resourceId.toString(), "not owner");
        throw ApiException.notFound(resourceType);
    }
}
