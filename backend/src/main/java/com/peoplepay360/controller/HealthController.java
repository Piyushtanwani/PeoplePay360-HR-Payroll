package com.peoplepay360.controller;

import com.peoplepay360.repository.AiProfileRepository;
import com.peoplepay360.service.McpClient;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/health")
public class HealthController {
    private final JdbcTemplate jdbc;
    private final McpClient mcp;
    private final AiProfileRepository aiProfiles;

    public HealthController(JdbcTemplate jdbc, McpClient mcp, AiProfileRepository aiProfiles) {
        this.jdbc = jdbc;
        this.mcp = mcp;
        this.aiProfiles = aiProfiles;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('user.read')")
    public Map<String, Object> health() {
        Map<String, Object> out = new HashMap<>();
        boolean db;
        try { jdbc.queryForObject("SELECT 1", Integer.class); db = true; } catch (Exception e) { db = false; }
        out.put("db", db);
        Map<String, Object> mcpHealth = mcp.health();
        out.put("mcp", Map.of("reachable", "ok".equals(mcpHealth.get("status")),
                "version", mcpHealth.getOrDefault("version", "unknown")));
        out.put("ai", aiProfiles.findByIsDefaultTrue()
                .map(p -> Map.of("profile", (Object) p.getName(), "lastTestOk", p.getLastTestOk() != null && p.getLastTestOk()))
                .orElse(Map.of("profile", "none", "lastTestOk", false)));
        out.put("mail", true);
        return out;
    }
}
