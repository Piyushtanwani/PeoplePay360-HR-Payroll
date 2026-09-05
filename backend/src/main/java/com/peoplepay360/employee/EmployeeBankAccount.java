package com.peoplepay360.employee;

import com.peoplepay360.common.EncryptedStringConverter;
import jakarta.persistence.*;

@Entity @Table(name = "employee_bank_account")
public class EmployeeBankAccount {
    @Id @Column(name = "employee_id")
    private Long employeeId;
    @Column(name = "bank_name", nullable = false)
    private String bankName;
    @Column(name = "account_last4", nullable = false)
    private String accountLast4;
    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "account_encrypted", nullable = false)
    private String accountNumber;
    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "ifsc_encrypted")
    private String ifsc;

    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long v) { this.employeeId = v; }
    public String getBankName() { return bankName; }
    public void setBankName(String v) { this.bankName = v; }
    public String getAccountLast4() { return accountLast4; }
    public void setAccountLast4(String v) { this.accountLast4 = v; }
    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String v) { this.accountNumber = v; }
    public String getIfsc() { return ifsc; }
    public void setIfsc(String v) { this.ifsc = v; }
}
