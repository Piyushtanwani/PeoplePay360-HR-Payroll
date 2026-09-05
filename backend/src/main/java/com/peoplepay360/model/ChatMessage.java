package com.peoplepay360.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.OffsetDateTime;

@Entity @Table(name = "chat_message")
public class ChatMessage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "session_id", nullable = false) private Long sessionId;
    @Column(nullable = false) private String role;
    @Column(nullable = false, columnDefinition = "text") private String content;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "blocks_json", columnDefinition = "jsonb")
    private String blocksJson;
    @Column(name = "created_at") private OffsetDateTime createdAt = OffsetDateTime.now();

    public Long getId() { return id; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long v) { this.sessionId = v; }
    public String getRole() { return role; }
    public void setRole(String v) { this.role = v; }
    public String getContent() { return content; }
    public void setContent(String v) { this.content = v; }
    public String getBlocksJson() { return blocksJson; }
    public void setBlocksJson(String v) { this.blocksJson = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
