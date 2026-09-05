package com.peoplepay360.service;

import com.peoplepay360.config.AppProperties;
import com.peoplepay360.model.AiProfile;
import com.peoplepay360.repository.AiProfileRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

/** Liveness of the things this service depends on, for the admin health screen. */
@Service
public class HealthService {
    private final JdbcTemplate jdbc;
    private final McpClient mcp;
    private final AiProfileRepository aiProfiles;
    private final JavaMailSenderImpl mailSender;
    private final AppProperties props;

    public HealthService(JdbcTemplate jdbc, McpClient mcp, AiProfileRepository aiProfiles,
                         org.springframework.mail.javamail.JavaMailSender mailSender, AppProperties props) {
        this.jdbc = jdbc;
        this.mcp = mcp;
        this.aiProfiles = aiProfiles;
        this.mailSender = mailSender instanceof JavaMailSenderImpl impl ? impl : null;
        this.props = props;
    }

    @PreAuthorize("hasAuthority('user.read')")
    @Transactional(readOnly = true)
    public Map<String, Object> health() {
        Map<String, Object> out = new HashMap<>();
        out.put("db", databaseReachable());
        Map<String, Object> mcpHealth = mcp.health();
        out.put("mcp", Map.of("reachable", "ok".equals(mcpHealth.get("status")),
                "version", mcpHealth.getOrDefault("version", "unknown")));
        out.put("ai", aiProfiles.findByIsDefaultTrue()
                .map(this::aiCard)
                .orElse(Map.of("profile", "none", "lastTestOk", false)));
        out.put("mail", mailCard());
        return out;
    }

    private boolean databaseReachable() {
        try {
            jdbc.queryForObject("SELECT 1", Integer.class);
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    private Map<String, Object> aiCard(AiProfile p) {
        return Map.of("profile", p.getName(), "lastTestOk", p.getLastTestOk() != null && p.getLastTestOk());
    }

    /**
     * Whether an SMTP server is actually listening, rather than the hard-coded true this used to
     * report. Invites and payslip emails fail silently when nothing is there, so it is worth knowing.
     */
    private Map<String, Object> mailCard() {
        if (mailSender == null) return Map.of("reachable", false, "host", "not configured");
        String host = mailSender.getHost() == null ? "" : mailSender.getHost();
        boolean reachable = false;
        try (java.net.Socket socket = new java.net.Socket()) {
            socket.connect(new java.net.InetSocketAddress(host, mailSender.getPort()), 500);
            reachable = true;
        } catch (Exception ignored) {
            // Not reachable; reported as such rather than raised.
        }
        return Map.of("reachable", reachable, "host", host + ":" + mailSender.getPort(),
                "from", props.getMailFrom());
    }
}
