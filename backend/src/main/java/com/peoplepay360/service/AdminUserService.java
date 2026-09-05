package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.dto.IdentityDtos.*;
import com.peoplepay360.security.AuthorityService;
import com.peoplepay360.security.LockoutGuard;
import com.peoplepay360.common.Paging;
import com.peoplepay360.common.Specs;
import com.peoplepay360.security.CurrentUser;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import com.peoplepay360.model.AppUser;
import com.peoplepay360.model.Role;
import com.peoplepay360.model.UserPermissionGrant;
import com.peoplepay360.repository.AppUserRepository;
import com.peoplepay360.repository.EffectivePermissionRepository;
import com.peoplepay360.repository.RoleRepository;
import com.peoplepay360.repository.UserPermissionGrantRepository;

@Service
public class AdminUserService {
    private static final Map<String, String> SORTS = Map.of(
            "email", "email", "displayName", "displayName", "active", "active",
            "createdAt", "createdAt", "roleCode", "role.code");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("displayName"));

    private final AppUserRepository users;
    private final RoleRepository roles;
    private final UserPermissionGrantRepository grants;
    private final EffectivePermissionRepository effective;
    private final PasswordEncoder encoder;
    private final AuthorityService authorityService;
    private final LockoutGuard lockoutGuard;
    private final AuditService audit;
    private final UserInviteService invites;
    private final com.peoplepay360.config.AppProperties props;
    private final com.peoplepay360.repository.EmployeeRepository employees;
    private final com.peoplepay360.repository.DepartmentRepository departments;
    private final CurrentUser currentUser;

    public AdminUserService(AppUserRepository users, RoleRepository roles, UserPermissionGrantRepository grants,
                            EffectivePermissionRepository effective, PasswordEncoder encoder,
                            AuthorityService authorityService, LockoutGuard lockoutGuard, AuditService audit,
                            UserInviteService invites, com.peoplepay360.config.AppProperties props,
                            com.peoplepay360.repository.EmployeeRepository employees,
                            com.peoplepay360.repository.DepartmentRepository departments,
                            CurrentUser currentUser) {
        this.invites = invites;
        this.props = props;
        this.employees = employees;
        this.departments = departments;
        this.currentUser = currentUser;
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
    public Page<UserDetail> list(String q, Boolean active, String roleCode, Pageable pageable) {
        Specification<AppUser> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                ps.add(cb.or(Specs.like(cb, root.get("email"), q),
                        Specs.like(cb, root.get("displayName"), q)));
            }
            if (active != null) ps.add(cb.equal(root.get("active"), active));
            if (roleCode != null && !roleCode.isBlank()) {
                ps.add(cb.equal(root.join("role").get("code"), roleCode));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return users.findAll(spec, Paging.normalise(pageable, DEFAULT_SORT, SORTS)).map(this::toDetail);
    }

    @PreAuthorize("hasAuthority('user.read')")
    @Transactional(readOnly = true)
    public UserDetail get(Long id) {
        return toDetail(users.findById(id).orElseThrow(() -> ApiException.notFound("user")));
    }

    @PreAuthorize("hasAuthority('user.create')")
    @Transactional
    public CreateUserResult create(CreateUser in) {
        Role role = roles.findByCode(in.roleCode()).orElseThrow(() -> ApiException.validation("Unknown role"));
        assertMayAssign(role.getCode());
        users.findByEmailIgnoreCase(in.email()).ifPresent(x -> {
            throw ApiException.conflict("A user with that email already exists.");
        });
        if (in.employeeId() != null) {
            users.findByEmployeeId(in.employeeId()).ifPresent(x -> {
                throw ApiException.conflict("That employee already has a login: " + x.getEmail());
            });
        }
        boolean invite = in.sendInvite() == null || in.sendInvite();

        AppUser u = new AppUser();
        u.setEmail(in.email());
        u.setDisplayName(in.displayName());
        u.setRole(role);
        u.setEmployeeId(in.employeeId());
        u.setActive(in.active() == null || in.active());
        // With an invite the account has no usable password until the link is redeemed.
        u.setPasswordHash(encoder.encode(invite
                ? java.util.UUID.randomUUID() + java.util.UUID.randomUUID().toString()
                : in.password()));
        u = users.save(u);
        linkEmployee(u);
        audit.record(Channel.UI, "CREATE_USER", "user", u.getId().toString(), "ALLOW", null, null, null);

        if (!invite) {
            u.setPasswordSetAt(java.time.OffsetDateTime.now());
            u = users.save(u);
            return new CreateUserResult(toDetail(u), false, "Password set manually.");
        }
        String token = invites.mint(u.getId(), "INVITE", props.getInviteTtlHours());
        boolean sent = invites.sendInvite(u, token, false);
        return new CreateUserResult(toDetail(u), sent, sent
                ? "Invite emailed to " + u.getEmail()
                : "User created, but the invite email could not be sent. Use Resend invite.");
    }

    /** Re-sends the set-password link, invalidating any earlier one. */
    @PreAuthorize("hasAuthority('user.update')")
    @Transactional
    public CreateUserResult resendInvite(Long id) {
        AppUser u = users.findById(id).orElseThrow(() -> ApiException.notFound("user"));
        String token = invites.mint(u.getId(), "INVITE", props.getInviteTtlHours());
        boolean sent = invites.sendInvite(u, token, false);
        audit.record(Channel.UI, "RESEND_INVITE", "user", u.getId().toString(),
                sent ? "ALLOW" : "DENY", null, null, null);
        return new CreateUserResult(toDetail(u), sent, sent
                ? "Invite re-sent to " + u.getEmail()
                : "Could not send the email. Check the SMTP settings.");
    }

    /** Employees who do not yet have a login, for the create-user picker. */
    @PreAuthorize("hasAuthority('user.create')")
    @Transactional(readOnly = true)
    public List<InvitableEmployee> invitableEmployees() {
        java.util.Set<Long> linked = new java.util.HashSet<>(users.findLinkedEmployeeIds());
        return employees.findAll().stream()
                .filter(e -> e.isActive() && !linked.contains(e.getId()))
                .map(e -> new InvitableEmployee(e.getId(), e.getEmployeeNo(), e.getDisplayName(),
                        e.getWorkEmail(), e.getJobTitle(),
                        e.getDepartmentId() == null ? null
                                : departments.findById(e.getDepartmentId())
                                    .map(com.peoplepay360.model.Department::getName).orElse(null)))
                .sorted(java.util.Comparator.comparing(InvitableEmployee::displayName))
                .toList();
    }

    @PreAuthorize("hasAuthority('user.update')")
    @Transactional
    public UserDetail update(Long id, UpdateUser in) {
        AppUser u = users.findById(id).orElseThrow(() -> ApiException.notFound("user"));
        if (in.displayName() != null) u.setDisplayName(in.displayName());
        if (in.employeeId() != null) {
            u.setEmployeeId(in.employeeId());
            linkEmployee(u);
        }
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
        assertMayAssign(role.getCode());
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

    /**
     * HR roles may create logins so that onboarding is one action, but only an administrator may mint
     * another administrator. Without this, user.create would be a route to full access.
     */
    private void assertMayAssign(String roleCode) {
        if (!"ADMIN".equals(roleCode)) return;
        if (!"ADMIN".equals(currentUser.get().roleCode())) {
            throw new com.peoplepay360.common.PermissionDeniedException("role.assign.admin");
        }
    }

    /** Keeps the employee's pointer to their login in step; only the seeder used to set it. */
    private void linkEmployee(AppUser u) {
        if (u.getEmployeeId() == null) return;
        employees.findById(u.getEmployeeId()).ifPresent(e -> e.setUserId(u.getId()));
    }

    /** The employee ids that already have a login, used by the onboarding flow to refuse duplicates. */
    boolean hasLogin(Long employeeId) {
        return users.findByEmployeeId(employeeId).isPresent();
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
                u.getEmployeeId(), u.isActive(), gc, u.getPasswordSetAt());
    }
    GrantDto toGrant(UserPermissionGrant g) {
        boolean active = g.getRevokedAt() == null &&
                (g.getExpiresAt() == null || g.getExpiresAt().isAfter(java.time.OffsetDateTime.now()));
        String byName = users.findById(g.getGrantedBy()).map(AppUser::getDisplayName).orElse(null);
        return new GrantDto(g.getId(), g.getUserId(), g.getPermissionCode(), g.getEffect(), g.getReason(),
                g.getGrantedBy(), byName, g.getGrantedAt(), g.getExpiresAt(), g.getRevokedAt(), active);
    }
}
