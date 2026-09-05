package com.peoplepay360.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity @Table(name = "candidate")
public class Candidate {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "opening_id", nullable = false) private Long openingId;
    @Column(name = "display_code", nullable = false) private String displayCode;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)
    private String profile = "{}";
    @Column(name = "expected_salary") private BigDecimal expectedSalary;
    @Column(name = "available_from") private LocalDate availableFrom;
    @Column(nullable = false) private String stage = "NEW";
    @Column(name = "hired_employee_id") private Long hiredEmployeeId;
    @Column(name = "rejection_reason") private String rejectionReason;
    @Version private long version;

    public Long getId() { return id; }
    public Long getOpeningId() { return openingId; }
    public void setOpeningId(Long v) { this.openingId = v; }
    public String getDisplayCode() { return displayCode; }
    public void setDisplayCode(String v) { this.displayCode = v; }
    public String getProfile() { return profile; }
    public void setProfile(String v) { this.profile = v; }
    public BigDecimal getExpectedSalary() { return expectedSalary; }
    public void setExpectedSalary(BigDecimal v) { this.expectedSalary = v; }
    public LocalDate getAvailableFrom() { return availableFrom; }
    public void setAvailableFrom(LocalDate v) { this.availableFrom = v; }
    public String getStage() { return stage; }
    public void setStage(String v) { this.stage = v; }
    public Long getHiredEmployeeId() { return hiredEmployeeId; }
    public void setHiredEmployeeId(Long v) { this.hiredEmployeeId = v; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String v) { this.rejectionReason = v; }
}
