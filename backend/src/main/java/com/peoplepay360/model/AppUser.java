package com.peoplepay360.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity @Table(name = "app_user")
public class AppUser {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true)
    private String email;
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;
    @Column(name = "display_name", nullable = false)
    private String displayName;
    @ManyToOne(fetch = FetchType.EAGER) @JoinColumn(name = "role_id", nullable = false)
    private Role role;
    @Column(name = "employee_id")
    private Long employeeId;
    @Column(name = "perm_version", nullable = false)
    private int permVersion = 1;
    @Column(nullable = false)
    private boolean active = true;
    @Column(name = "is_break_glass", nullable = false)
    private boolean breakGlass = false;
    @Column(name = "created_at")
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public void setEmail(String v) { this.email = v; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String v) { this.passwordHash = v; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String v) { this.displayName = v; }
    public Role getRole() { return role; }
    public void setRole(Role v) { this.role = v; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long v) { this.employeeId = v; }
    public int getPermVersion() { return permVersion; }
    public void setPermVersion(int v) { this.permVersion = v; }
    public boolean isActive() { return active; }
    public void setActive(boolean v) { this.active = v; }
    public boolean isBreakGlass() { return breakGlass; }
    public void setBreakGlass(boolean v) { this.breakGlass = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
