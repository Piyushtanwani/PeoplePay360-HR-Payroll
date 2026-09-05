package com.peoplepay360.controller;

import com.peoplepay360.service.HealthService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/health")
public class HealthController {
    private final HealthService service;

    public HealthController(HealthService service) {
        this.service = service;
    }

    @GetMapping
    public Map<String, Object> health() {
        return service.health();
    }
}
