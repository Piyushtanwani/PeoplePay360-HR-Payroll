package com.peoplepay360.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity @Table(name = "user_permission_grant")
public class UserPermissionGrant {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "permission_code", nullable = false)
    private String permissionCode;
    @Column(nullable = false)
    private String effect = "ALLOW";
    @Column(nullable = false)
    private String reason;
    @Column(name = "granted_by", nullable = false)
    private Long grantedBy;
    @Column(name = "granted_at", nullable = false)
    private OffsetDateTime grantedAt = OffsetDateTime.now();
    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;
    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long v) { this.userId = v; }
    public String getPermissionCode() { return permissionCode; }
    public void setPermissionCode(String v) { this.permissionCode = v; }
    public String getEffect() { return effect; }
    public void setEffect(String v) { this.effect = v; }
    public String getReason() { return reason; }
    public void setReason(String v) { this.reason = v; }
    public Long getGrantedBy() { return grantedBy; }
    public void setGrantedBy(Long v) { this.grantedBy = v; }
    public OffsetDateTime getGrantedAt() { return grantedAt; }
    public void setGrantedAt(OffsetDateTime v) { this.grantedAt = v; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(OffsetDateTime v) { this.expiresAt = v; }
    public OffsetDateTime getRevokedAt() { return revokedAt; }
    public void setRevokedAt(OffsetDateTime v) { this.revokedAt = v; }
}
