package com.peoplepay360.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity @Table(name = "contract")
public class Contract {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true)
    private String reference;
    @Column(name = "employee_id", nullable = false)
    private Long employeeId;
    @Column(nullable = false)
    private BigDecimal wage;
    @Column(name = "wage_type", nullable = false)
    private String wageType = "MONTHLY";
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;
    @Column(name = "end_date")
    private LocalDate endDate;
    @Column(nullable = false)
    private String state = "DRAFT";
    @Column(name = "working_schedule_id")
    private Long workingScheduleId;
    @Column(name = "salary_structure_id")
    private Long salaryStructureId;
    @Column(name = "job_title")
    private String jobTitle;
    @Column(name = "department_id")
    private Long departmentId;
    @Column(name = "source_offer_id")
    private Long sourceOfferId;
    @Version
    private long version;

    public Long getId() { return id; }
    public String getReference() { return reference; }
    public void setReference(String v) { this.reference = v; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long v) { this.employeeId = v; }
    public BigDecimal getWage() { return wage; }
    public void setWage(BigDecimal v) { this.wage = v; }
    public String getWageType() { return wageType; }
    public void setWageType(String v) { this.wageType = v; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate v) { this.startDate = v; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate v) { this.endDate = v; }
    public String getState() { return state; }
    public void setState(String v) { this.state = v; }
    public Long getWorkingScheduleId() { return workingScheduleId; }
    public void setWorkingScheduleId(Long v) { this.workingScheduleId = v; }
    public Long getSalaryStructureId() { return salaryStructureId; }
    public void setSalaryStructureId(Long v) { this.salaryStructureId = v; }
    public String getJobTitle() { return jobTitle; }
    public void setJobTitle(String v) { this.jobTitle = v; }
    public Long getDepartmentId() { return departmentId; }
    public void setDepartmentId(Long v) { this.departmentId = v; }
    public Long getSourceOfferId() { return sourceOfferId; }
    public void setSourceOfferId(Long v) { this.sourceOfferId = v; }
    public long getVersion() { return version; }

    /** Derived state: a RUNNING contract past its end date is reported EXPIRED. */
    public String derivedState(LocalDate today) {
        if ("RUNNING".equals(state) && endDate != null && endDate.isBefore(today)) return "EXPIRED";
        return state;
    }
    public boolean intersects(LocalDate from, LocalDate to) {
        LocalDate e = endDate == null ? LocalDate.MAX : endDate;
        return !startDate.isAfter(to) && !e.isBefore(from);
    }
    public boolean containsDate(LocalDate d) {
        LocalDate e = endDate == null ? LocalDate.MAX : endDate;
        return !startDate.isAfter(d) && !e.isBefore(d);
    }
}
