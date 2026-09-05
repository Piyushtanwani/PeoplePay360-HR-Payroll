package com.peoplepay360.model;

import jakarta.persistence.*;

@Entity @Table(name = "candidate_identity")
public class CandidateIdentity {
    @Id @Column(name = "candidate_id") private Long candidateId;
    @Column(name = "display_name", nullable = false) private String displayName;
    private String email;
    private String phone;
    public Long getCandidateId() { return candidateId; }
    public void setCandidateId(Long v) { this.candidateId = v; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String v) { this.displayName = v; }
    public String getEmail() { return email; }
    public void setEmail(String v) { this.email = v; }
    public String getPhone() { return phone; }
    public void setPhone(String v) { this.phone = v; }
}
