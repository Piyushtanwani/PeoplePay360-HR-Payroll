package com.peoplepay360.payroll;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity @Table(name = "payrun_input")
public class PayrunInput {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "payrun_id", nullable = false) private Long payrunId;
    @Column(name = "employee_id", nullable = false) private Long employeeId;
    @Column(nullable = false) private String code;
    @Column(nullable = false) private BigDecimal value;
    @Column(nullable = false) private String source = "COMPUTED";
    public Long getId() { return id; }
    public Long getPayrunId() { return payrunId; }
    public void setPayrunId(Long v) { this.payrunId = v; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long v) { this.employeeId = v; }
    public String getCode() { return code; }
    public void setCode(String v) { this.code = v; }
    public BigDecimal getValue() { return value; }
    public void setValue(BigDecimal v) { this.value = v; }
    public String getSource() { return source; }
    public void setSource(String v) { this.source = v; }
}
