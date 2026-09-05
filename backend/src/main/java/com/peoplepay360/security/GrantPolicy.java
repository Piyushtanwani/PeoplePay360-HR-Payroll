package com.peoplepay360.security;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.model.AppUser;
import com.peoplepay360.repository.EffectivePermissionRepository;
import com.peoplepay360.model.Permission;
import com.peoplepay360.repository.PermissionRepository;
import org.springframework.stereotype.Component;
import java.util.Set;

/** Enforces the grant policy from Part B5. Every rule is checked server-side. */
@Component
public class GrantPolicy {
    private final PermissionRepository permissions;
    private final EffectivePermissionRepository effective;
    public GrantPolicy(PermissionRepository permissions, EffectivePermissionRepository effective) {
        this.permissions = permissions;
        this.effective = effective;
    }

    public void validate(AppUser grantor, Long targetUserId, String permissionCode) {
        Permission p = permissions.findById(permissionCode)
                .orElseThrow(() -> ApiException.validation("Unknown permission code: " + permissionCode));
        // 1. no self-grants
        if (grantor.getId().equals(targetUserId)) {
            throw new ApiException(ErrorCode.PERMISSION_DENIED, "You cannot grant permissions to yourself.");
        }
        // 4. seed.manage is never grantable
        if (!p.isGrantable()) {
            throw new ApiException(ErrorCode.PERMISSION_DENIED, "This permission cannot be granted.");
        }
        // 2. admin-tier codes only by an Admin
        boolean grantorIsAdmin = "ADMIN".equals(grantor.getRole().getCode());
        if ("ADMIN".equals(p.getTier()) && !grantorIsAdmin) {
            throw new ApiException(ErrorCode.PERMISSION_DENIED, "Only an administrator may grant this permission.");
        }
        // 3. a grantor may grant only codes within their own effective set
        Set<String> grantorPerms = Set.copyOf(effective.findCodesByUserId(grantor.getId()));
        if (!grantorPerms.contains(permissionCode)) {
            throw new ApiException(ErrorCode.PERMISSION_DENIED,
                    "You cannot grant a permission you do not hold: " + permissionCode);
        }
    }
}
