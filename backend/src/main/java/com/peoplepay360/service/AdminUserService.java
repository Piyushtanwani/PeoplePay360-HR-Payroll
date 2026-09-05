package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.dto.IdentityDtos.*;
import com.peoplepay360.security.AuthorityService;
import com.peoplepay360.security.LockoutGuard;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import com.peoplepay360.model.AppUser;
import com.peoplepay360.model.Role;
import com.peoplepay360.model.UserPermissionGrant;
import com.peoplepay360.repository.AppUserRepository;
import com.peoplepay360.repository.EffectivePermissionRepository;
import com.peoplepay360.repository.RoleRepository;
import com.peoplepay360.repository.UserPermissionGrantRepository;

@Service
public class AdminUserService {
    private final AppUserRepository users;
    private final RoleRepository roles;
    private final UserPermissionGrantRepository grants;
    private final EffectivePermissionRepository effective;
    private final PasswordEncoder encoder;
    private final AuthorityService authorityService;
    private final LockoutGuard lockoutGuard;
    private final AuditService audit;

    public AdminUserService(AppUserRepository users, RoleRepository roles, UserPermissionGrantRepository grants,
                            EffectivePermissionRepository effective, PasswordEncoder encoder,
                            AuthorityService authorityService, LockoutGuard lockoutGuard, AuditService audit) {
        this.users = users;
        this.roles = roles;
        this.grants = grants;
        this.effective = effective;
        this.encoder = encoder;
        this.authorityService = authorityService;
        this.lockoutGuard = lockoutGuard;
        this.audit = audit;
    }

    @PreAuthorize("hasAuthority('user.read')")
    @Transactional(readOnly = true)
    public Page<UserDetail> list(String q, Pageable pageable) {
        Specification<AppUser> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.toLowerCase() + "%";
                ps.add(cb.or(cb.like(cb.lower(root.get("email")), like),
                        cb.like(cb.lower(root.get("displayName")), like)));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return users.findAll(spec, pageable).map(this::toDetail);
    }

    @PreAuthorize("hasAuthority('user.read')")
    @Transactional(readOnly = true)
    public UserDetail get(Long id) {
        return toDetail(users.findById(id).orElseThrow(() -> ApiException.notFound("user")));
    }

    @PreAuthorize("hasAuthority('user.create')")
    @Transactional
    public UserDetail create(CreateUser in) {
        Role role = roles.findByCode(in.roleCode()).orElseThrow(() -> ApiException.validation("Unknown role"));
        AppUser u = new AppUser();
        u.setEmail(in.email());
        u.setDisplayName(in.displayName());
        u.setRole(role);
        u.setEmployeeId(in.employeeId());
        u.setActive(in.active() == null || in.active());
        u.setPasswordHash(encoder.encode(in.password() == null ? "ChangeMe@123" : in.password()));
        u = users.save(u);
        audit.record(Channel.UI, "CREATE_USER", "user", u.getId().toString(), "ALLOW", null, null, null);
        return toDetail(u);
    }

    @PreAuthorize("hasAuthority('user.update')")
    @Transactional
    public UserDetail update(Long id, UpdateUser in) {
        AppUser u = users.findById(id).orElseThrow(() -> ApiException.notFound("user"));
        if (in.displayName() != null) u.setDisplayName(in.displayName());
        if (in.employeeId() != null) u.setEmployeeId(in.employeeId());
        if (in.password() != null && !in.password().isBlank()) u.setPasswordHash(encoder.encode(in.password()));
        if (in.active() != null) {
            if (!in.active()) lockoutGuard.assertNotLastGrantAdmin(holdsGrantAdmin(id));
            u.setActive(in.active());
            bumpVersion(u);
        }
        audit.record(Channel.UI, "UPDATE_USER", "user", id.toString(), "ALLOW", null, null, null);
        return toDetail(u);
    }

    @PreAuthorize("hasAuthority('role.assign')")
    @Transactional
    public UserDetail assignRole(Long id, RoleAssign in) {
        AppUser u = users.findById(id).orElseThrow(() -> ApiException.notFound("user"));
        Role role = roles.findByCode(in.roleCode()).orElseThrow(() -> ApiException.validation("Unknown role"));
        if (holdsGrantAdmin(id) && !"ADMIN".equals(in.roleCode())) {
            lockoutGuard.assertNotLastGrantAdmin(true);
        }
        u.setRole(role);
        bumpVersion(u);
        audit.record(Channel.UI, "ASSIGN_ROLE", "user", id.toString(), "ALLOW", in.roleCode(), null, null);
        return toDetail(u);
    }

    @PreAuthorize("hasAuthority('user.read')")
    @Transactional(readOnly = true)
    public UserPermissions permissions(Long id) {
        AppUser u = users.findById(id).orElseThrow(() -> ApiException.notFound("user"));
        List<String> eff = effective.findCodesByUserId(id);
        List<String> fromRole = new ArrayList<>(eff); // role-derived subset approximation for display
        List<GrantDto> grantDtos = grants.findByUserIdOrderByGrantedAtDesc(id).stream().map(this::toGrant).toList();
        return new UserPermissions(eff, fromRole, grantDtos);
    }

    boolean holdsGrantAdmin(Long userId) {
        return effective.findCodesByUserId(userId).contains("permission.grant");
    }
    void bumpVersion(AppUser u) {
        u.setPermVersion(u.getPermVersion() + 1);
        users.save(u);
        authorityService.evict(u.getId());
    }
    private UserDetail toDetail(AppUser u) {
        int gc = grants.findByUserIdOrderByGrantedAtDesc(u.getId()).size();
        return new UserDetail(u.getId(), u.getEmail(), u.getDisplayName(), u.getRole().getCode(),
                u.getEmployeeId(), u.isActive(), gc);
    }
    GrantDto toGrant(UserPermissionGrant g) {
        boolean active = g.getRevokedAt() == null &&
                (g.getExpiresAt() == null || g.getExpiresAt().isAfter(java.time.OffsetDateTime.now()));
        String byName = users.findById(g.getGrantedBy()).map(AppUser::getDisplayName).orElse(null);
        return new GrantDto(g.getId(), g.getUserId(), g.getPermissionCode(), g.getEffect(), g.getReason(),
                g.getGrantedBy(), byName, g.getGrantedAt(), g.getExpiresAt(), g.getRevokedAt(), active);
    }
}
