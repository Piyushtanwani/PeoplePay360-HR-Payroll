package com.peoplepay360.chat;

import jakarta.persistence.*;

@Entity @Table(name = "chat_tool_call")
public class ChatToolCall {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "message_id", nullable = false) private Long messageId;
    @Column(name = "tool_name", nullable = false) private String toolName;
    @Column(name = "resource_type") private String resourceType;
    @Column(name = "resource_id") private String resourceId;
    @Column(name = "prompt_hash") private String promptHash;
    @Column(nullable = false) private boolean allowed;
    @Column(name = "denial_code") private String denialCode;
    @Column(name = "http_status") private Integer httpStatus;
    @Column(name = "latency_ms") private Integer latencyMs;

    public Long getId() { return id; }
    public Long getMessageId() { return messageId; }
    public void setMessageId(Long v) { this.messageId = v; }
    public String getToolName() { return toolName; }
    public void setToolName(String v) { this.toolName = v; }
    public String getResourceType() { return resourceType; }
    public void setResourceType(String v) { this.resourceType = v; }
    public String getResourceId() { return resourceId; }
    public void setResourceId(String v) { this.resourceId = v; }
    public String getPromptHash() { return promptHash; }
    public void setPromptHash(String v) { this.promptHash = v; }
    public boolean isAllowed() { return allowed; }
    public void setAllowed(boolean v) { this.allowed = v; }
    public String getDenialCode() { return denialCode; }
    public void setDenialCode(String v) { this.denialCode = v; }
    public Integer getHttpStatus() { return httpStatus; }
    public void setHttpStatus(Integer v) { this.httpStatus = v; }
    public Integer getLatencyMs() { return latencyMs; }
    public void setLatencyMs(Integer v) { this.latencyMs = v; }
}
