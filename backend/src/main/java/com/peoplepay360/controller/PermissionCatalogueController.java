package com.peoplepay360.controller;

import com.peoplepay360.dto.IdentityDtos.PermissionCatalogueEntry;
import com.peoplepay360.security.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;
import com.peoplepay360.repository.EffectivePermissionRepository;
import com.peoplepay360.repository.PermissionRepository;

@RestController
@RequestMapping("/api/admin/permissions")
public class PermissionCatalogueController {
    private final PermissionRepository permissions;
    private final EffectivePermissionRepository effective;
    private final CurrentUser currentUser;

    public PermissionCatalogueController(PermissionRepository permissions, EffectivePermissionRepository effective,
                                         CurrentUser currentUser) {
        this.permissions = permissions;
        this.effective = effective;
        this.currentUser = currentUser;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('user.read')")
    public List<PermissionCatalogueEntry> catalogue() {
        Set<String> mine = Set.copyOf(effective.findCodesByUserId(currentUser.userId()));
        boolean admin = currentUser.hasAuthority("ROLE_ADMIN");
        return permissions.findAll().stream().map(p -> {
            boolean grantableByMe = p.isGrantable()
                    && mine.contains(p.getCode())
                    && (!"ADMIN".equals(p.getTier()) || admin);
            return new PermissionCatalogueEntry(p.getCode(), p.getResource(), p.getAction(), p.getScope(),
                    p.getTier(), p.getDescription(), grantableByMe);
        }).toList();
    }
}
