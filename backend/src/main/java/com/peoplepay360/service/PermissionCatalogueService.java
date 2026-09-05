package com.peoplepay360.service;

import com.peoplepay360.dto.IdentityDtos.PermissionCatalogueEntry;
import com.peoplepay360.repository.EffectivePermissionRepository;
import com.peoplepay360.repository.PermissionRepository;
import com.peoplepay360.security.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * The permission catalogue, with each entry marked according to whether the caller could actually
 * grant it. The interface uses that flag to disable the option and say why, rather than offering a
 * choice the server would refuse.
 */
@Service
public class PermissionCatalogueService {
    private final PermissionRepository permissions;
    private final EffectivePermissionRepository effective;
    private final CurrentUser currentUser;

    public PermissionCatalogueService(PermissionRepository permissions, EffectivePermissionRepository effective,
                                      CurrentUser currentUser) {
        this.permissions = permissions;
        this.effective = effective;
        this.currentUser = currentUser;
    }

    @PreAuthorize("hasAuthority('user.read')")
    @Transactional(readOnly = true)
    public List<PermissionCatalogueEntry> catalogue() {
        // Nobody may grant a permission they do not themselves hold, and an ADMIN-tier permission is
        // reserved to administrators regardless of who holds it.
        Set<String> mine = Set.copyOf(effective.findCodesByUserId(currentUser.userId()));
        boolean admin = currentUser.hasAuthority("ROLE_ADMIN");
        return permissions.findAll().stream()
                .sorted(Comparator.comparing(p -> p.getCode()))
                .map(p -> new PermissionCatalogueEntry(p.getCode(), p.getResource(), p.getAction(), p.getScope(),
                        p.getTier(), p.getDescription(),
                        p.isGrantable() && mine.contains(p.getCode()) && (!"ADMIN".equals(p.getTier()) || admin)))
                .toList();
    }
}
