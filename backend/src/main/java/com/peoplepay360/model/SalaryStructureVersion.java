package com.peoplepay360.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.OffsetDateTime;

@Entity @Table(name = "salary_structure_version")
public class SalaryStructureVersion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "structure_id", nullable = false) private Long structureId;
    @Column(name = "version_no", nullable = false) private int versionNo;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)
    private String snapshot;
    @Column(name = "created_at") private OffsetDateTime createdAt = OffsetDateTime.now();

    public Long getId() { return id; }
    public Long getStructureId() { return structureId; }
    public void setStructureId(Long v) { this.structureId = v; }
    public int getVersionNo() { return versionNo; }
    public void setVersionNo(int v) { this.versionNo = v; }
    public String getSnapshot() { return snapshot; }
    public void setSnapshot(String v) { this.snapshot = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
