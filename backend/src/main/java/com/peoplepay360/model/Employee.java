package com.peoplepay360.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity @Table(name = "employee")
public class Employee {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "employee_no", nullable = false, unique = true)
    private String employeeNo;
    @Column(name = "display_name", nullable = false)
    private String displayName;
    @Column(name = "work_email")
    private String workEmail;
    @Column(name = "job_title")
    private String jobTitle;
    @Column(name = "hire_date")
    private LocalDate hireDate;
    @Column(name = "department_id")
    private Long departmentId;
    @Column(name = "employee_type", nullable = false)
    private String employeeType = "FULL_TIME";
    @Column(name = "manager_id")
    private Long managerId;
    @Column(name = "user_id")
    private Long userId;
    @Column(name = "working_schedule_id")
    private Long workingScheduleId;
    @Column(nullable = false)
    private boolean active = true;
    @Column(name = "created_at")
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public Long getId() { return id; }
    public String getEmployeeNo() { return employeeNo; }
    public void setEmployeeNo(String v) { this.employeeNo = v; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String v) { this.displayName = v; }
    public String getWorkEmail() { return workEmail; }
    public void setWorkEmail(String v) { this.workEmail = v; }
    public String getJobTitle() { return jobTitle; }
    public void setJobTitle(String v) { this.jobTitle = v; }
    public LocalDate getHireDate() { return hireDate; }
    public void setHireDate(LocalDate v) { this.hireDate = v; }
    public Long getDepartmentId() { return departmentId; }
    public void setDepartmentId(Long v) { this.departmentId = v; }
    public String getEmployeeType() { return employeeType; }
    public void setEmployeeType(String v) { this.employeeType = v; }
    public Long getManagerId() { return managerId; }
    public void setManagerId(Long v) { this.managerId = v; }
    public Long getUserId() { return userId; }
    public void setUserId(Long v) { this.userId = v; }
    public Long getWorkingScheduleId() { return workingScheduleId; }
    public void setWorkingScheduleId(Long v) { this.workingScheduleId = v; }
    public boolean isActive() { return active; }
    public void setActive(boolean v) { this.active = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
