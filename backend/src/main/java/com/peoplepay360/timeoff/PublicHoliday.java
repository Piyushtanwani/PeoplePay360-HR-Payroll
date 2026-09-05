package com.peoplepay360.timeoff;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity @Table(name = "public_holiday")
public class PublicHoliday {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true) private LocalDate date;
    @Column(nullable = false) private String name;
    public Long getId() { return id; }
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate v) { this.date = v; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
}
