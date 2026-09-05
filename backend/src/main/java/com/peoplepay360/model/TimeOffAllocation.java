package com.peoplepay360.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity @Table(name = "time_off_allocation")
public class TimeOffAllocation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "employee_id", nullable = false) private Long employeeId;
    @Column(name = "type_id", nullable = false) private Long typeId;
    @Column(nullable = false) private BigDecimal days;
    @Column(name = "valid_from") private LocalDate validFrom;
    @Column(name = "valid_to") private LocalDate validTo;
    @Column(nullable = false) private String state = "DRAFT";
    @Column(name = "approved_by") private Long approvedBy;
    @Column(name = "approved_at") private OffsetDateTime approvedAt;
    private String note;

    public Long getId() { return id; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long v) { this.employeeId = v; }
    public Long getTypeId() { return typeId; }
    public void setTypeId(Long v) { this.typeId = v; }
    public BigDecimal getDays() { return days; }
    public void setDays(BigDecimal v) { this.days = v; }
    public LocalDate getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDate v) { this.validFrom = v; }
    public LocalDate getValidTo() { return validTo; }
    public void setValidTo(LocalDate v) { this.validTo = v; }
    public String getState() { return state; }
    public void setState(String v) { this.state = v; }
    public Long getApprovedBy() { return approvedBy; }
    public void setApprovedBy(Long v) { this.approvedBy = v; }
    public OffsetDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(OffsetDateTime v) { this.approvedAt = v; }
    public String getNote() { return note; }
    public void setNote(String v) { this.note = v; }
}
