package com.peoplepay360.payroll;

import jakarta.persistence.*;

@Entity @Table(name = "payrun_issue")
public class PayrunIssue {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "payrun_id", nullable = false) private Long payrunId;
    @Column(name = "employee_id") private Long employeeId;
    @Column(name = "check_code", nullable = false) private String checkCode;
    @Column(nullable = false) private String severity;
    @Column(nullable = false) private boolean overridable;
    @Column(nullable = false) private String message;
    @Column(nullable = false) private String status = "OPEN";
    @Column(name = "override_reason") private String overrideReason;
    @Column(name = "resolved_by") private Long resolvedBy;
    @Column(name = "fix_link") private String fixLink;

    public Long getId() { return id; }
    public Long getPayrunId() { return payrunId; }
    public void setPayrunId(Long v) { this.payrunId = v; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long v) { this.employeeId = v; }
    public String getCheckCode() { return checkCode; }
    public void setCheckCode(String v) { this.checkCode = v; }
    public String getSeverity() { return severity; }
    public void setSeverity(String v) { this.severity = v; }
    public boolean isOverridable() { return overridable; }
    public void setOverridable(boolean v) { this.overridable = v; }
    public String getMessage() { return message; }
    public void setMessage(String v) { this.message = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public String getOverrideReason() { return overrideReason; }
    public void setOverrideReason(String v) { this.overrideReason = v; }
    public Long getResolvedBy() { return resolvedBy; }
    public void setResolvedBy(Long v) { this.resolvedBy = v; }
    public String getFixLink() { return fixLink; }
    public void setFixLink(String v) { this.fixLink = v; }
}
