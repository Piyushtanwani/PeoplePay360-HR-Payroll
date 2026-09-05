package com.peoplepay360.model;

import jakarta.persistence.*;

@Entity @Table(name = "department")
public class Department {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true)
    private String name;
    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
}
