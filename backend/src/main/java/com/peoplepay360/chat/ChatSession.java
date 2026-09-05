package com.peoplepay360.chat;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity @Table(name = "chat_session")
public class ChatSession {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false) private Long userId;
    private String title;
    @Column(name = "started_at") private OffsetDateTime startedAt = OffsetDateTime.now();
    @Column(name = "last_message_at") private OffsetDateTime lastMessageAt;
    @Column(name = "deleted_at") private OffsetDateTime deletedAt;

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long v) { this.userId = v; }
    public String getTitle() { return title; }
    public void setTitle(String v) { this.title = v; }
    public OffsetDateTime getStartedAt() { return startedAt; }
    public OffsetDateTime getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(OffsetDateTime v) { this.lastMessageAt = v; }
    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime v) { this.deletedAt = v; }
}
