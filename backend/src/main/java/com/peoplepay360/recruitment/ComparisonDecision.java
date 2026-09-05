package com.peoplepay360.recruitment;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity @Table(name = "comparison_decision")
public class ComparisonDecision {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "comparison_id", nullable = false) private Long comparisonId;
    @Column(name = "candidate_id", nullable = false) private Long candidateId;
    @Column(nullable = false) private String decision;
    @Column(nullable = false) private String rationale;
    @Column(name = "decided_by") private Long decidedBy;
    @Column(name = "decided_at") private OffsetDateTime decidedAt = OffsetDateTime.now();

    public Long getId() { return id; }
    public Long getComparisonId() { return comparisonId; }
    public void setComparisonId(Long v) { this.comparisonId = v; }
    public Long getCandidateId() { return candidateId; }
    public void setCandidateId(Long v) { this.candidateId = v; }
    public String getDecision() { return decision; }
    public void setDecision(String v) { this.decision = v; }
    public String getRationale() { return rationale; }
    public void setRationale(String v) { this.rationale = v; }
    public Long getDecidedBy() { return decidedBy; }
    public void setDecidedBy(Long v) { this.decidedBy = v; }
    public OffsetDateTime getDecidedAt() { return decidedAt; }
}
