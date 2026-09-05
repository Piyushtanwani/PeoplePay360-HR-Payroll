package com.peoplepay360.timeoff;

import jakarta.persistence.*;

@Entity @Table(name = "time_off_type")
public class TimeOffType {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private String name;
    @Column(nullable = false, unique = true) private String code;
    @Column(nullable = false) private String unit = "DAYS";
    @Column(name = "is_paid", nullable = false) private boolean paid = true;
    @Column(name = "requires_allocation", nullable = false) private boolean requiresAllocation = true;
    @Column(nullable = false) private String color = "#0A84FF";
    @Column(nullable = false) private boolean active = true;

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
    public String getCode() { return code; }
    public void setCode(String v) { this.code = v; }
    public String getUnit() { return unit; }
    public void setUnit(String v) { this.unit = v; }
    public boolean isPaid() { return paid; }
    public void setPaid(boolean v) { this.paid = v; }
    public boolean isRequiresAllocation() { return requiresAllocation; }
    public void setRequiresAllocation(boolean v) { this.requiresAllocation = v; }
    public String getColor() { return color; }
    public void setColor(String v) { this.color = v; }
    public boolean isActive() { return active; }
    public void setActive(boolean v) { this.active = v; }
}
