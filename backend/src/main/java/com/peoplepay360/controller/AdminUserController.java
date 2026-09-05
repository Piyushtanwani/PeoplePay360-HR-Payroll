package com.peoplepay360.controller;

import com.peoplepay360.common.PageResponse;
import com.peoplepay360.dto.IdentityDtos.*;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import com.peoplepay360.service.AdminUserService;
import com.peoplepay360.service.GrantService;

@RestController
@RequestMapping("/api/admin")
public class AdminUserController {
    private final AdminUserService users;
    private final GrantService grants;
    public AdminUserController(AdminUserService users, GrantService grants) {
        this.users = users;
        this.grants = grants;
    }

    @GetMapping("/users")
    public PageResponse<UserDetail> list(@RequestParam(required = false) String q, Pageable pageable) {
        return PageResponse.of(users.list(q, pageable));
    }
    @GetMapping("/users/{id}")
    public UserDetail get(@PathVariable Long id) { return users.get(id); }
    @PostMapping("/users")
    public CreateUserResult create(@Valid @RequestBody CreateUser in) { return users.create(in); }

    @PostMapping("/users/{id}/resend-invite")
    public CreateUserResult resendInvite(@PathVariable Long id) { return users.resendInvite(id); }

    /** Active employees without a login, offered when creating a user. */
    @GetMapping("/users/invitable-employees")
    public List<InvitableEmployee> invitableEmployees() { return users.invitableEmployees(); }
    @PutMapping("/users/{id}")
    public UserDetail update(@PathVariable Long id, @RequestBody UpdateUser in) { return users.update(id, in); }
    @PostMapping("/users/{id}/role")
    public UserDetail assignRole(@PathVariable Long id, @Valid @RequestBody RoleAssign in) {
        return users.assignRole(id, in);
    }
    @GetMapping("/users/{id}/permissions")
    public UserPermissions permissions(@PathVariable Long id) { return users.permissions(id); }
    @PostMapping("/users/{id}/grants")
    public GrantDto grant(@PathVariable Long id, @Valid @RequestBody CreateGrant in) {
        return grants.create(id, in);
    }
    @DeleteMapping("/grants/{grantId}")
    public void revoke(@PathVariable Long grantId) { grants.revoke(grantId); }
}
