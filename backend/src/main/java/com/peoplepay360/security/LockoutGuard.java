package com.peoplepay360.security;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.repository.EffectivePermissionRepository;
import org.springframework.stereotype.Component;

/** Prevents any change that would leave the platform with zero active holders of permission.grant. */
@Component
public class LockoutGuard {
    private static final String KEY = "permission.grant";
    private final EffectivePermissionRepository effective;
    public LockoutGuard(EffectivePermissionRepository effective) { this.effective = effective; }

    /** Call before removing permission.grant from a user (role change, DENY grant, deactivation, deletion). */
    public void assertNotLastGrantAdmin(boolean userCurrentlyHoldsGrant) {
        if (!userCurrentlyHoldsGrant) return;
        if (effective.countUsersWithPermission(KEY) <= 1) {
            throw ApiException.illegalState("This change would leave no administrator able to grant permissions.");
        }
    }
}
