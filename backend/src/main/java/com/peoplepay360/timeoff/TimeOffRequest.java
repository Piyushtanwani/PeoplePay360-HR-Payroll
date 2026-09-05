package com.peoplepay360.timeoff;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity @Table(name = "time_off_request")
public class TimeOffRequest {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "employee_id", nullable = false) private Long employeeId;
    @Column(name = "type_id", nullable = false) private Long typeId;
    @Column(name = "start_date", nullable = false) private LocalDate startDate;
    @Column(name = "end_date", nullable = false) private LocalDate endDate;
    @Column(nullable = false) private BigDecimal days;
    @Column(nullable = false) private String state = "PENDING";
    private String reason;
    private String anomaly;
    @Column(name = "decided_by") private Long decidedBy;
    @Column(name = "decided_at") private OffsetDateTime decidedAt;
    @Column(name = "decision_note") private String decisionNote;
    @Version private long version;

    public Long getId() { return id; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long v) { this.employeeId = v; }
    public Long getTypeId() { return typeId; }
    public void setTypeId(Long v) { this.typeId = v; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate v) { this.startDate = v; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate v) { this.endDate = v; }
    public BigDecimal getDays() { return days; }
    public void setDays(BigDecimal v) { this.days = v; }
    public String getState() { return state; }
    public void setState(String v) { this.state = v; }
    public String getReason() { return reason; }
    public void setReason(String v) { this.reason = v; }
    public String getAnomaly() { return anomaly; }
    public void setAnomaly(String v) { this.anomaly = v; }
    public Long getDecidedBy() { return decidedBy; }
    public void setDecidedBy(Long v) { this.decidedBy = v; }
    public OffsetDateTime getDecidedAt() { return decidedAt; }
    public void setDecidedAt(OffsetDateTime v) { this.decidedAt = v; }
    public String getDecisionNote() { return decisionNote; }
    public void setDecisionNote(String v) { this.decisionNote = v; }
    public long getVersion() { return version; }
}
