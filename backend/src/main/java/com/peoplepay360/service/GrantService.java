package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.dto.IdentityDtos.*;
import com.peoplepay360.security.AuthorityService;
import com.peoplepay360.security.CurrentUser;
import com.peoplepay360.security.GrantPolicy;
import com.peoplepay360.security.LockoutGuard;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import com.peoplepay360.model.AppUser;
import com.peoplepay360.model.UserPermissionGrant;
import com.peoplepay360.repository.AppUserRepository;
import com.peoplepay360.repository.UserPermissionGrantRepository;

@Service
public class GrantService {
    private final UserPermissionGrantRepository grants;
    private final AppUserRepository users;
    private final GrantPolicy grantPolicy;
    private final LockoutGuard lockoutGuard;
    private final AuthorityService authorityService;
    private final CurrentUser currentUser;
    private final AdminUserService adminUserService;
    private final AuditService audit;

    public GrantService(UserPermissionGrantRepository grants, AppUserRepository users, GrantPolicy grantPolicy,
                        LockoutGuard lockoutGuard, AuthorityService authorityService, CurrentUser currentUser,
                        AdminUserService adminUserService, AuditService audit) {
        this.grants = grants;
        this.users = users;
        this.grantPolicy = grantPolicy;
        this.lockoutGuard = lockoutGuard;
        this.authorityService = authorityService;
        this.currentUser = currentUser;
        this.adminUserService = adminUserService;
        this.audit = audit;
    }

    @PreAuthorize("hasAuthority('permission.grant')")
    @Transactional
    public GrantDto create(Long targetUserId, CreateGrant in) {
        AppUser grantor = users.findById(currentUser.userId()).orElseThrow(() -> ApiException.notFound("user"));
        AppUser target = users.findById(targetUserId).orElseThrow(() -> ApiException.notFound("user"));
        grantPolicy.validate(grantor, targetUserId, in.permissionCode());
        String effect = in.effect() == null ? "ALLOW" : in.effect();
        if ("DENY".equals(effect) && "permission.grant".equals(in.permissionCode())) {
            lockoutGuard.assertNotLastGrantAdmin(adminUserService.holdsGrantAdmin(targetUserId));
        }
        UserPermissionGrant g = new UserPermissionGrant();
        g.setUserId(targetUserId);
        g.setPermissionCode(in.permissionCode());
        g.setEffect(effect);
        g.setReason(in.reason());
        g.setGrantedBy(grantor.getId());
        g.setExpiresAt(in.expiresAt());
        g = grants.save(g);
        adminUserService.bumpVersion(target);
        audit.record(Channel.UI, "GRANT", "user", targetUserId.toString(), "ALLOW",
                effect + " " + in.permissionCode() + ": " + in.reason(), null, null);
        return adminUserService.toGrant(g);
    }

    @PreAuthorize("hasAuthority('permission.grant')")
    @Transactional
    public void revoke(Long grantId) {
        UserPermissionGrant g = grants.findById(grantId).orElseThrow(() -> ApiException.notFound("grant"));
        if ("ALLOW".equals(g.getEffect()) && "permission.grant".equals(g.getPermissionCode())) {
            lockoutGuard.assertNotLastGrantAdmin(adminUserService.holdsGrantAdmin(g.getUserId()));
        }
        g.setRevokedAt(OffsetDateTime.now());
        grants.save(g);
        users.findById(g.getUserId()).ifPresent(adminUserService::bumpVersion);
        audit.record(Channel.UI, "REVOKE_GRANT", "user", g.getUserId().toString(), "ALLOW",
                g.getPermissionCode(), null, null);
    }
}
