package com.peoplepay360.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity @Table(name = "payrun")
public class Payrun {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private String name;
    @Column(name = "structure_id", nullable = false) private Long structureId;
    @Column(name = "period_start", nullable = false) private LocalDate periodStart;
    @Column(name = "period_end", nullable = false) private LocalDate periodEnd;
    @Column(nullable = false) private String state = "DRAFT";
    @Column(name = "created_by") private Long createdBy;
    @Column(name = "created_at") private OffsetDateTime createdAt = OffsetDateTime.now();
    @Column(name = "computed_at") private OffsetDateTime computedAt;
    @Column(name = "validated_by") private Long validatedBy;
    @Column(name = "validated_at") private OffsetDateTime validatedAt;
    @Column(name = "paid_by") private Long paidBy;
    @Column(name = "paid_at") private OffsetDateTime paidAt;
    @Column(name = "sent_at") private OffsetDateTime sentAt;
    @Version private long version;

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
    public Long getStructureId() { return structureId; }
    public void setStructureId(Long v) { this.structureId = v; }
    public LocalDate getPeriodStart() { return periodStart; }
    public void setPeriodStart(LocalDate v) { this.periodStart = v; }
    public LocalDate getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(LocalDate v) { this.periodEnd = v; }
    public String getState() { return state; }
    public void setState(String v) { this.state = v; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long v) { this.createdBy = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getComputedAt() { return computedAt; }
    public void setComputedAt(OffsetDateTime v) { this.computedAt = v; }
    public Long getValidatedBy() { return validatedBy; }
    public void setValidatedBy(Long v) { this.validatedBy = v; }
    public OffsetDateTime getValidatedAt() { return validatedAt; }
    public void setValidatedAt(OffsetDateTime v) { this.validatedAt = v; }
    public Long getPaidBy() { return paidBy; }
    public void setPaidBy(Long v) { this.paidBy = v; }
    public OffsetDateTime getPaidAt() { return paidAt; }
    public void setPaidAt(OffsetDateTime v) { this.paidAt = v; }
    public OffsetDateTime getSentAt() { return sentAt; }
    public void setSentAt(OffsetDateTime v) { this.sentAt = v; }
    public long getVersion() { return version; }
}
