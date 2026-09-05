package com.peoplepay360.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * A reusable set of contract terms. Selecting one while creating an employee produces a real
 * {@link Contract}; templates themselves are never read by payroll.
 */
@Entity
@Table(name = "contract_template")
public class ContractTemplate {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true) private String name;
    @Column(nullable = false) private BigDecimal wage;
    @Column(name = "wage_type", nullable = false) private String wageType = "MONTHLY";
    @Column(name = "working_schedule_id") private Long workingScheduleId;
    @Column(name = "salary_structure_id") private Long salaryStructureId;
    @Column(name = "job_title") private String jobTitle;
    private String description;
    @Column(nullable = false) private boolean active = true;
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
    public BigDecimal getWage() { return wage; }
    public void setWage(BigDecimal v) { this.wage = v; }
    public String getWageType() { return wageType; }
    public void setWageType(String v) { this.wageType = v; }
    public Long getWorkingScheduleId() { return workingScheduleId; }
    public void setWorkingScheduleId(Long v) { this.workingScheduleId = v; }
    public Long getSalaryStructureId() { return salaryStructureId; }
    public void setSalaryStructureId(Long v) { this.salaryStructureId = v; }
    public String getJobTitle() { return jobTitle; }
    public void setJobTitle(String v) { this.jobTitle = v; }
    public String getDescription() { return description; }
    public void setDescription(String v) { this.description = v; }
    public boolean isActive() { return active; }
    public void setActive(boolean v) { this.active = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
