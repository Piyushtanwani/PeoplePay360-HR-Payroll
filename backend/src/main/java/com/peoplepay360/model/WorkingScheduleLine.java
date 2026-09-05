package com.peoplepay360.model;

import jakarta.persistence.*;
import java.time.LocalTime;

@Entity @Table(name = "working_schedule_line")
public class WorkingScheduleLine {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    /** Owning side, so a new line's foreign key is written by the insert rather than a follow-up update. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private WorkingSchedule schedule;
    @Column(name = "day_of_week", nullable = false)
    private int dayOfWeek;
    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;
    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;
    @Column(name = "break_minutes", nullable = false)
    private int breakMinutes;

    public Long getId() { return id; }
    public WorkingSchedule getSchedule() { return schedule; }
    public void setSchedule(WorkingSchedule v) { this.schedule = v; }
    public Long getScheduleId() { return schedule == null ? null : schedule.getId(); }
    public int getDayOfWeek() { return dayOfWeek; }
    public void setDayOfWeek(int v) { this.dayOfWeek = v; }
    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime v) { this.startTime = v; }
    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime v) { this.endTime = v; }
    public int getBreakMinutes() { return breakMinutes; }
    public void setBreakMinutes(int v) { this.breakMinutes = v; }
}
