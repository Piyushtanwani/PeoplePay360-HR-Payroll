package com.peoplepay360.controller;

import com.peoplepay360.dto.IdentityDtos.LoginResponse;
import com.peoplepay360.service.DemoAdminService;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Demo-profile utilities. Absent entirely from a production build. */
@RestController
@Profile("demo")
public class SeedController {
    private final DemoAdminService service;

    public SeedController(DemoAdminService service) {
        this.service = service;
    }

    @PostMapping("/api/auth/demo-switch")
    public LoginResponse demoSwitch(@RequestBody Map<String, String> body) {
        return service.demoSwitch(body.get("email"));
    }

    @PostMapping("/api/admin/seed/reset")
    public Map<String, Object> reset() {
        return service.reset();
    }

    @PostMapping("/api/admin/chat/debug-token")
    public Map<String, Object> debugToken(@RequestBody Map<String, Object> body) {
        return service.debugToken(((Number) body.get("userId")).longValue());
    }
}
