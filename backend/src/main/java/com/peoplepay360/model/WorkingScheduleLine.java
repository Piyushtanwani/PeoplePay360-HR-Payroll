package com.peoplepay360.model;

import jakarta.persistence.*;
import java.time.LocalTime;

@Entity @Table(name = "working_schedule_line")
public class WorkingScheduleLine {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "schedule_id", nullable = false, insertable = false, updatable = false)
    private Long scheduleId;
    @Column(name = "day_of_week", nullable = false)
    private int dayOfWeek;
    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;
    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;
    @Column(name = "break_minutes", nullable = false)
    private int breakMinutes;

    public Long getId() { return id; }
    public Long getScheduleId() { return scheduleId; }
    public void setScheduleId(Long v) { this.scheduleId = v; }
    public int getDayOfWeek() { return dayOfWeek; }
    public void setDayOfWeek(int v) { this.dayOfWeek = v; }
    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime v) { this.startTime = v; }
    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime v) { this.endTime = v; }
    public int getBreakMinutes() { return breakMinutes; }
    public void setBreakMinutes(int v) { this.breakMinutes = v; }
}
