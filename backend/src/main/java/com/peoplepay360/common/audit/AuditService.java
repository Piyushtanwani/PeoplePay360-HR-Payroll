package com.peoplepay360.common.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.peoplepay360.common.RequestContext;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.List;
import com.peoplepay360.model.AuditEvent;

@Service
public class AuditService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AuditService.class);
    private final AuditWriter writer;
    private final ObjectMapper mapper;

    public AuditService(AuditWriter writer, ObjectMapper mapper) {
        this.writer = writer;
        this.mapper = mapper;
    }

    public void record(Channel channel, String action, String resourceType, String resourceId,
                       String outcome, String reason, String beforeJson, String afterJson) {
        try {
            AuditEvent e = new AuditEvent();
            Authentication a = SecurityContextHolder.getContext().getAuthentication();
            if (a != null && a.getPrincipal() instanceof Jwt jwt) {
                e.setActorUserId(Long.valueOf(jwt.getSubject()));
                e.setActorName(jwt.getClaimAsString("name"));
                List<String> roles = jwt.getClaimAsStringList("roles");
                if (roles != null) e.setActorRoles(roles.toArray(new String[0]));
            }
            e.setChannel(channel.name());
            e.setAction(action);
            e.setResourceType(resourceType);
            e.setResourceId(resourceId);
            e.setOutcome(outcome);
            e.setReason(reason);
            e.setBeforeJson(asJson(beforeJson));
            e.setAfterJson(asJson(afterJson));
            e.setRequestId(RequestContext.getRequestId());
            writer.write(e);
        } catch (Exception ex) {
            // Auditing must never break the request it describes.
            log.warn("Failed to write audit event {} {}: {}", action, resourceType, ex.getMessage());
        }
    }

    public void allow(Channel channel, String action, String resourceType, String resourceId) {
        record(channel, action, resourceType, resourceId, "ALLOW", null, null, null);
    }
    public void deny(Channel channel, String action, String resourceType, String resourceId, String reason) {
        record(channel, action, resourceType, resourceId, "DENY", reason, null, null);
    }
    public void system(String action, String resourceType, String resourceId, String reason) {
        record(Channel.SYSTEM, action, resourceType, resourceId, "ALLOW", reason, null, null);
    }
    public String toJson(Object o) {
        try { return o == null ? null : mapper.writeValueAsString(o); }
        catch (Exception e) { return null; }
    }

    /**
     * Makes a before/after value safe for the json columns.
     *
     * <p>Most callers pass a serialised object, but some record a single value: a display name, the
     * last four digits of an account. Postgres rejects a bare word as json, and because auditing
     * swallows its own failures the row simply never appeared. A change to where wages are paid must
     * not be the one event with no trail, so a plain value is quoted into a json string here.
     */
    private String asJson(String value) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        try {
            mapper.readTree(trimmed);
            return trimmed;
        } catch (Exception notJson) {
            return toJson(value);
        }
    }
}
