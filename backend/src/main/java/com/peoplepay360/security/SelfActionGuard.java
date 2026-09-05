package com.peoplepay360.security;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import org.springframework.stereotype.Component;

/** Refuses the six self-action paths for every role, closing the officer-edits-own-record fraud path. */
@Component
public class SelfActionGuard {
    private final CurrentUser currentUser;
    private final AuditService audit;
    public SelfActionGuard(CurrentUser currentUser, AuditService audit) {
        this.currentUser = currentUser;
        this.audit = audit;
    }

    public void assertNotSelf(Long targetEmployeeId, String action, String resourceType) {
        Long own = currentUser.employeeId();
        if (own != null && own.equals(targetEmployeeId)) {
            audit.deny(Channel.UI, action, resourceType,
                    targetEmployeeId == null ? null : targetEmployeeId.toString(), "self action forbidden");
            throw new ApiException(ErrorCode.SELF_ACTION, "You cannot perform this action on your own record.");
        }
    }
}
