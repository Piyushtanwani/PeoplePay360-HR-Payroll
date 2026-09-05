package com.peoplepay360.payroll;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity @Table(name = "payslip_line")
public class PayslipLine {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "payslip_id", nullable = false) private Long payslipId;
    @Column(name = "rule_id") private Long ruleId;
    @Column(name = "rule_code", nullable = false) private String ruleCode;
    @Column(name = "rule_name", nullable = false) private String ruleName;
    @Column(nullable = false) private String category;
    @Column(nullable = false) private int sequence;
    @Column(nullable = false) private BigDecimal amount;

    public Long getId() { return id; }
    public Long getPayslipId() { return payslipId; }
    public void setPayslipId(Long v) { this.payslipId = v; }
    public Long getRuleId() { return ruleId; }
    public void setRuleId(Long v) { this.ruleId = v; }
    public String getRuleCode() { return ruleCode; }
    public void setRuleCode(String v) { this.ruleCode = v; }
    public String getRuleName() { return ruleName; }
    public void setRuleName(String v) { this.ruleName = v; }
    public String getCategory() { return category; }
    public void setCategory(String v) { this.category = v; }
    public int getSequence() { return sequence; }
    public void setSequence(int v) { this.sequence = v; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal v) { this.amount = v; }
}
