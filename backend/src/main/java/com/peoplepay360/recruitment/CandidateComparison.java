package com.peoplepay360.recruitment;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.OffsetDateTime;

@Entity @Table(name = "candidate_comparison")
public class CandidateComparison {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "opening_id", nullable = false) private Long openingId;
    @JdbcTypeCode(SqlTypes.ARRAY) @Column(name = "candidate_ids", columnDefinition = "bigint[]", nullable = false)
    private Long[] candidateIds;
    @Column(name = "rubric_version", nullable = false) private int rubricVersion = 1;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false) private String weights = "{}";
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false) private String result = "{}";
    private String model;
    @Column(name = "prompt_version") private String promptVersion;
    @Column(name = "requested_by") private Long requestedBy;
    @Column(name = "created_at") private OffsetDateTime createdAt = OffsetDateTime.now();

    public Long getId() { return id; }
    public Long getOpeningId() { return openingId; }
    public void setOpeningId(Long v) { this.openingId = v; }
    public Long[] getCandidateIds() { return candidateIds; }
    public void setCandidateIds(Long[] v) { this.candidateIds = v; }
    public int getRubricVersion() { return rubricVersion; }
    public void setRubricVersion(int v) { this.rubricVersion = v; }
    public String getWeights() { return weights; }
    public void setWeights(String v) { this.weights = v; }
    public String getResult() { return result; }
    public void setResult(String v) { this.result = v; }
    public String getModel() { return model; }
    public void setModel(String v) { this.model = v; }
    public String getPromptVersion() { return promptVersion; }
    public void setPromptVersion(String v) { this.promptVersion = v; }
    public Long getRequestedBy() { return requestedBy; }
    public void setRequestedBy(Long v) { this.requestedBy = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
