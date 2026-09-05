package com.peoplepay360.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity @Table(name = "payslip_delivery")
public class PayslipDelivery {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "payslip_id", nullable = false) private Long payslipId;
    private String recipient;
    @Column(nullable = false) private String channel = "EMAIL";
    @Column(nullable = false) private String status = "NOT_SENT";
    @Column(nullable = false) private int attempts = 0;
    @Column(name = "last_error") private String lastError;
    @Column(name = "sent_at") private OffsetDateTime sentAt;
    @Column(name = "pdf_sha256") private String pdfSha256;

    public Long getId() { return id; }
    public Long getPayslipId() { return payslipId; }
    public void setPayslipId(Long v) { this.payslipId = v; }
    public String getRecipient() { return recipient; }
    public void setRecipient(String v) { this.recipient = v; }
    public String getChannel() { return channel; }
    public void setChannel(String v) { this.channel = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int v) { this.attempts = v; }
    public String getLastError() { return lastError; }
    public void setLastError(String v) { this.lastError = v; }
    public OffsetDateTime getSentAt() { return sentAt; }
    public void setSentAt(OffsetDateTime v) { this.sentAt = v; }
    public String getPdfSha256() { return pdfSha256; }
    public void setPdfSha256(String v) { this.pdfSha256 = v; }
}
