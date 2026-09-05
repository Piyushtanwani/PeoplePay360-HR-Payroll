package com.peoplepay360.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.OffsetDateTime;

@Entity
@Table(name = "audit_event")
public class AuditEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private OffsetDateTime occurredAt = OffsetDateTime.now();
    private Long actorUserId;
    private String actorName;
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "actor_roles", columnDefinition = "text[]")
    private String[] actorRoles = new String[0];
    private String channel;
    private String action;
    private String resourceType;
    private String resourceId;
    private String outcome;
    private String reason;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    private String beforeJson;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    private String afterJson;
    private String requestId;

    public Long getId() { return id; }
    public OffsetDateTime getOccurredAt() { return occurredAt; }
    public void setOccurredAt(OffsetDateTime v) { this.occurredAt = v; }
    public Long getActorUserId() { return actorUserId; }
    public void setActorUserId(Long v) { this.actorUserId = v; }
    public String getActorName() { return actorName; }
    public void setActorName(String v) { this.actorName = v; }
    public String[] getActorRoles() { return actorRoles; }
    public void setActorRoles(String[] v) { this.actorRoles = v; }
    public String getChannel() { return channel; }
    public void setChannel(String v) { this.channel = v; }
    public String getAction() { return action; }
    public void setAction(String v) { this.action = v; }
    public String getResourceType() { return resourceType; }
    public void setResourceType(String v) { this.resourceType = v; }
    public String getResourceId() { return resourceId; }
    public void setResourceId(String v) { this.resourceId = v; }
    public String getOutcome() { return outcome; }
    public void setOutcome(String v) { this.outcome = v; }
    public String getReason() { return reason; }
    public void setReason(String v) { this.reason = v; }
    public String getBeforeJson() { return beforeJson; }
    public void setBeforeJson(String v) { this.beforeJson = v; }
    public String getAfterJson() { return afterJson; }
    public void setAfterJson(String v) { this.afterJson = v; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String v) { this.requestId = v; }
}
