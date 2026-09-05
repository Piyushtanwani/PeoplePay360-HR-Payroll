package com.peoplepay360.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity @Table(name = "salary_structure")
public class SalaryStructure {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private String name;
    @Column(nullable = false, unique = true) private String code;
    @Column(nullable = false) private boolean active = true;
    /**
     * Mapped by the child rather than a join column. With a join column, saving the parent merges the
     * children, so the caller is handed a detached copy with no generated id, and Hibernate issues a
     * post-insert UPDATE to set the foreign key. Owning the relationship from the rule avoids both.
     */
    @OneToMany(mappedBy = "structure", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("sequence ASC")
    private List<SalaryRule> rules = new ArrayList<>();

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
    public String getCode() { return code; }
    public void setCode(String v) { this.code = v; }
    public boolean isActive() { return active; }
    public void setActive(boolean v) { this.active = v; }
    public List<SalaryRule> getRules() { return rules; }
    public void setRules(List<SalaryRule> v) { this.rules = v; }

    /** Adds a rule and sets the back-reference, which the foreign key depends on. */
    public void addRule(SalaryRule rule) {
        rule.setStructure(this);
        rules.add(rule);
    }
}
