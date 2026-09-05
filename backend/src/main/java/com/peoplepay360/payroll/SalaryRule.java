package com.peoplepay360.payroll;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity @Table(name = "salary_rule")
public class SalaryRule {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "structure_id", nullable = false, insertable = false, updatable = false) private Long structureId;
    @Column(nullable = false) private String name;
    @Column(nullable = false) private String code;
    @Column(nullable = false) private String category;
    @Column(nullable = false) private int sequence;
    @Column(name = "compute_type", nullable = false) private String computeType;
    @Column(name = "fixed_amount") private BigDecimal fixedAmount;
    private BigDecimal percentage;
    @Column(name = "base_rule_code") private String baseRuleCode;
    private String formula;
    @Column(nullable = false) private boolean active = true;
    private String description;

    public Long getId() { return id; }
    public Long getStructureId() { return structureId; }
    public void setStructureId(Long v) { this.structureId = v; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
    public String getCode() { return code; }
    public void setCode(String v) { this.code = v; }
    public String getCategory() { return category; }
    public void setCategory(String v) { this.category = v; }
    public int getSequence() { return sequence; }
    public void setSequence(int v) { this.sequence = v; }
    public String getComputeType() { return computeType; }
    public void setComputeType(String v) { this.computeType = v; }
    public BigDecimal getFixedAmount() { return fixedAmount; }
    public void setFixedAmount(BigDecimal v) { this.fixedAmount = v; }
    public BigDecimal getPercentage() { return percentage; }
    public void setPercentage(BigDecimal v) { this.percentage = v; }
    public String getBaseRuleCode() { return baseRuleCode; }
    public void setBaseRuleCode(String v) { this.baseRuleCode = v; }
    public String getFormula() { return formula; }
    public void setFormula(String v) { this.formula = v; }
    public boolean isActive() { return active; }
    public void setActive(boolean v) { this.active = v; }
    public String getDescription() { return description; }
    public void setDescription(String v) { this.description = v; }
}
