package com.peoplepay360.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity @Table(name = "working_schedule")
public class WorkingSchedule {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false)
    private String type = "FIXED";
    @Column(name = "weekly_hours", nullable = false)
    private BigDecimal weeklyHours = BigDecimal.ZERO;
    @Column(nullable = false)
    private boolean active = true;
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "schedule_id", nullable = false)
    private List<WorkingScheduleLine> lines = new ArrayList<>();

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
    public String getType() { return type; }
    public void setType(String v) { this.type = v; }
    public BigDecimal getWeeklyHours() { return weeklyHours; }
    public void setWeeklyHours(BigDecimal v) { this.weeklyHours = v; }
    public boolean isActive() { return active; }
    public void setActive(boolean v) { this.active = v; }
    public List<WorkingScheduleLine> getLines() { return lines; }
    public void setLines(List<WorkingScheduleLine> v) { this.lines = v; }
}
