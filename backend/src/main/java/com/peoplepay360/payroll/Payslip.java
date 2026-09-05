package com.peoplepay360.payroll;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity @Table(name = "payslip")
public class Payslip {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "payrun_id", nullable = false) private Long payrunId;
    @Column(name = "employee_id", nullable = false) private Long employeeId;
    @Column(name = "contract_id") private Long contractId;
    @Column(name = "structure_version_id") private Long structureVersionId;
    @Column(name = "period_start", nullable = false) private LocalDate periodStart;
    @Column(name = "period_end", nullable = false) private LocalDate periodEnd;
    @Column(name = "worked_days", nullable = false) private BigDecimal workedDays = BigDecimal.ZERO;
    @Column(name = "scheduled_days", nullable = false) private BigDecimal scheduledDays = BigDecimal.ZERO;
    @Column(name = "unpaid_days", nullable = false) private BigDecimal unpaidDays = BigDecimal.ZERO;
    @Column(nullable = false) private BigDecimal basic = BigDecimal.ZERO;
    @Column(nullable = false) private BigDecimal allowances = BigDecimal.ZERO;
    @Column(nullable = false) private BigDecimal deductions = BigDecimal.ZERO;
    @Column(nullable = false) private BigDecimal gross = BigDecimal.ZERO;
    @Column(nullable = false) private BigDecimal net = BigDecimal.ZERO;
    private String note;
    @Transient
    private List<PayslipLine> lines = new ArrayList<>();

    public Long getId() { return id; }
    public Long getPayrunId() { return payrunId; }
    public void setPayrunId(Long v) { this.payrunId = v; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long v) { this.employeeId = v; }
    public Long getContractId() { return contractId; }
    public void setContractId(Long v) { this.contractId = v; }
    public Long getStructureVersionId() { return structureVersionId; }
    public void setStructureVersionId(Long v) { this.structureVersionId = v; }
    public LocalDate getPeriodStart() { return periodStart; }
    public void setPeriodStart(LocalDate v) { this.periodStart = v; }
    public LocalDate getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(LocalDate v) { this.periodEnd = v; }
    public BigDecimal getWorkedDays() { return workedDays; }
    public void setWorkedDays(BigDecimal v) { this.workedDays = v; }
    public BigDecimal getScheduledDays() { return scheduledDays; }
    public void setScheduledDays(BigDecimal v) { this.scheduledDays = v; }
    public BigDecimal getUnpaidDays() { return unpaidDays; }
    public void setUnpaidDays(BigDecimal v) { this.unpaidDays = v; }
    public BigDecimal getBasic() { return basic; }
    public void setBasic(BigDecimal v) { this.basic = v; }
    public BigDecimal getAllowances() { return allowances; }
    public void setAllowances(BigDecimal v) { this.allowances = v; }
    public BigDecimal getDeductions() { return deductions; }
    public void setDeductions(BigDecimal v) { this.deductions = v; }
    public BigDecimal getGross() { return gross; }
    public void setGross(BigDecimal v) { this.gross = v; }
    public BigDecimal getNet() { return net; }
    public void setNet(BigDecimal v) { this.net = v; }
    public String getNote() { return note; }
    public void setNote(String v) { this.note = v; }
    public List<PayslipLine> getLines() { return lines; }
    public void setLines(List<PayslipLine> v) { this.lines = v; }
}
