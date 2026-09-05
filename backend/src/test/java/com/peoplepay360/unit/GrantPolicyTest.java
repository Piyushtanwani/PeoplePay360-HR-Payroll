package com.peoplepay360.unit;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.security.GrantPolicy;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;
import com.peoplepay360.model.AppUser;
import com.peoplepay360.model.Permission;
import com.peoplepay360.model.Role;
import com.peoplepay360.repository.EffectivePermissionRepository;
import com.peoplepay360.repository.PermissionRepository;

class GrantPolicyTest {
    private final PermissionRepository perms = mock(PermissionRepository.class);
    private final EffectivePermissionRepository effective = mock(EffectivePermissionRepository.class);
    private final GrantPolicy policy = new GrantPolicy(perms, effective);

    private AppUser user(long id, String roleCode) {
        AppUser u = new AppUser();
        setId(u, id);
        Role r = new Role();
        r.setCode(roleCode);
        u.setRole(r);
        return u;
    }
    private void setId(AppUser u, long id) {
        try { var f = AppUser.class.getDeclaredField("id"); f.setAccessible(true); f.set(u, id); }
        catch (Exception e) { throw new RuntimeException(e); }
    }
    private Permission perm(String code, String tier, boolean grantable) {
        Permission p = new Permission();
        set(p, "code", code);
        set(p, "tier", tier);
        set(p, "grantable", grantable);
        return p;
    }
    private void set(Object o, String field, Object value) {
        try { var f = o.getClass().getDeclaredField(field); f.setAccessible(true); f.set(o, value); }
        catch (Exception e) { throw new RuntimeException(e); }
    }

    @Test
    void refusesSelfGrant() {
        when(perms.findById("chat.access")).thenReturn(Optional.of(perm("chat.access", "NORMAL", true)));
        AppUser admin = user(1, "ADMIN");
        assertThatThrownBy(() -> policy.validate(admin, 1L, "chat.access"))
                .isInstanceOf(ApiException.class).hasMessageContaining("yourself");
    }

    @Test
    void refusesNonGrantableSeedManage() {
        when(perms.findById("seed.manage")).thenReturn(Optional.of(perm("seed.manage", "ADMIN", false)));
        AppUser admin = user(1, "ADMIN");
        assertThatThrownBy(() -> policy.validate(admin, 2L, "seed.manage"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void refusesAdminTierByNonAdmin() {
        when(perms.findById("audit.read")).thenReturn(Optional.of(perm("audit.read", "ADMIN", true)));
        AppUser mgr = user(1, "HR_PAYROLL_MANAGER");
        assertThatThrownBy(() -> policy.validate(mgr, 2L, "audit.read"))
                .isInstanceOf(ApiException.class).hasMessageContaining("administrator");
    }

    @Test
    void refusesCodeNotInGrantorEffectiveSet() {
        when(perms.findById("payrun.pay")).thenReturn(Optional.of(perm("payrun.pay", "NORMAL", true)));
        when(effective.findCodesByUserId(1L)).thenReturn(List.of("chat.access"));
        AppUser admin = user(1, "ADMIN");
        assertThatThrownBy(() -> policy.validate(admin, 2L, "payrun.pay"))
                .isInstanceOf(ApiException.class).hasMessageContaining("do not hold");
    }

    @Test
    void allowsValidGrant() {
        when(perms.findById("chat.access")).thenReturn(Optional.of(perm("chat.access", "NORMAL", true)));
        when(effective.findCodesByUserId(1L)).thenReturn(List.of("chat.access"));
        AppUser admin = user(1, "ADMIN");
        assertThatCode(() -> policy.validate(admin, 2L, "chat.access")).doesNotThrowAnyException();
    }
}
