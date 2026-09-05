package com.peoplepay360.controller;

import com.peoplepay360.dto.IdentityDtos.PermissionCatalogueEntry;
import com.peoplepay360.service.PermissionCatalogueService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/permissions")
public class PermissionCatalogueController {
    private final PermissionCatalogueService service;

    public PermissionCatalogueController(PermissionCatalogueService service) {
        this.service = service;
    }

    @GetMapping
    public List<PermissionCatalogueEntry> catalogue() {
        return service.catalogue();
    }
}
