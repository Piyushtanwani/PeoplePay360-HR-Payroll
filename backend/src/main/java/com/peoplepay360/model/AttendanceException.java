package com.peoplepay360.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity @Table(name = "attendance_exception")
public class AttendanceException {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "employee_id", nullable = false) private Long employeeId;
    @Column(name = "attendance_id") private Long attendanceId;
    @Column(nullable = false) private LocalDate date;
    @Column(nullable = false) private String type;
    @Column(nullable = false) private int minutes;
    @Column(nullable = false) private boolean resolved;

    public Long getId() { return id; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long v) { this.employeeId = v; }
    public Long getAttendanceId() { return attendanceId; }
    public void setAttendanceId(Long v) { this.attendanceId = v; }
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate v) { this.date = v; }
    public String getType() { return type; }
    public void setType(String v) { this.type = v; }
    public int getMinutes() { return minutes; }
    public void setMinutes(int v) { this.minutes = v; }
    public boolean isResolved() { return resolved; }
    public void setResolved(boolean v) { this.resolved = v; }
}
