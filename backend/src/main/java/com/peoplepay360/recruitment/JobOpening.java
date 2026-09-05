package com.peoplepay360.recruitment;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity @Table(name = "job_opening")
public class JobOpening {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private String title;
    @Column(name = "department_id") private Long departmentId;
    @Column(name = "salary_structure_id") private Long salaryStructureId;
    @Column(name = "working_schedule_id") private Long workingScheduleId;
    @Column(name = "band_min") private BigDecimal bandMin;
    @Column(name = "band_max") private BigDecimal bandMax;
    @Column(name = "target_start_date") private LocalDate targetStartDate;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)
    private String criteria = "[]";
    @Column(nullable = false) private String status = "OPEN";

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String v) { this.title = v; }
    public Long getDepartmentId() { return departmentId; }
    public void setDepartmentId(Long v) { this.departmentId = v; }
    public Long getSalaryStructureId() { return salaryStructureId; }
    public void setSalaryStructureId(Long v) { this.salaryStructureId = v; }
    public Long getWorkingScheduleId() { return workingScheduleId; }
    public void setWorkingScheduleId(Long v) { this.workingScheduleId = v; }
    public BigDecimal getBandMin() { return bandMin; }
    public void setBandMin(BigDecimal v) { this.bandMin = v; }
    public BigDecimal getBandMax() { return bandMax; }
    public void setBandMax(BigDecimal v) { this.bandMax = v; }
    public LocalDate getTargetStartDate() { return targetStartDate; }
    public void setTargetStartDate(LocalDate v) { this.targetStartDate = v; }
    public String getCriteria() { return criteria; }
    public void setCriteria(String v) { this.criteria = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
}
