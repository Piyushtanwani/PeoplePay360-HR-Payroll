package com.peoplepay360.common.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.peoplepay360.common.RequestContext;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AuditService {
    private final AuditEventRepository repo;
    private final ObjectMapper mapper;

    public AuditService(AuditEventRepository repo, ObjectMapper mapper) {
        this.repo = repo;
        this.mapper = mapper;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Channel channel, String action, String resourceType, String resourceId,
                       String outcome, String reason, String beforeJson, String afterJson) {
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
        e.setBeforeJson(beforeJson);
        e.setAfterJson(afterJson);
        e.setRequestId(RequestContext.getRequestId());
        repo.save(e);
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
}
