package com.peoplepay360.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity @Table(name = "attendance")
public class Attendance {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "employee_id", nullable = false) private Long employeeId;
    @Column(name = "work_date", nullable = false) private LocalDate workDate;
    @Column(name = "check_in") private OffsetDateTime checkIn;
    @Column(name = "check_out") private OffsetDateTime checkOut;
    @Column(name = "worked_minutes", nullable = false) private int workedMinutes;
    @Column(name = "scheduled_minutes", nullable = false) private int scheduledMinutes;
    @Column(nullable = false) private String status = "PRESENT";
    @Column(name = "is_manual_edit", nullable = false) private boolean manualEdit;
    @Column(name = "edited_by") private Long editedBy;
    @Column(name = "edit_reason") private String editReason;
    @Column(name = "original_check_out") private OffsetDateTime originalCheckOut;

    public Long getId() { return id; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long v) { this.employeeId = v; }
    public LocalDate getWorkDate() { return workDate; }
    public void setWorkDate(LocalDate v) { this.workDate = v; }
    public OffsetDateTime getCheckIn() { return checkIn; }
    public void setCheckIn(OffsetDateTime v) { this.checkIn = v; }
    public OffsetDateTime getCheckOut() { return checkOut; }
    public void setCheckOut(OffsetDateTime v) { this.checkOut = v; }
    public int getWorkedMinutes() { return workedMinutes; }
    public void setWorkedMinutes(int v) { this.workedMinutes = v; }
    public int getScheduledMinutes() { return scheduledMinutes; }
    public void setScheduledMinutes(int v) { this.scheduledMinutes = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public boolean isManualEdit() { return manualEdit; }
    public void setManualEdit(boolean v) { this.manualEdit = v; }
    public Long getEditedBy() { return editedBy; }
    public void setEditedBy(Long v) { this.editedBy = v; }
    public String getEditReason() { return editReason; }
    public void setEditReason(String v) { this.editReason = v; }
    public OffsetDateTime getOriginalCheckOut() { return originalCheckOut; }
    public void setOriginalCheckOut(OffsetDateTime v) { this.originalCheckOut = v; }
}
