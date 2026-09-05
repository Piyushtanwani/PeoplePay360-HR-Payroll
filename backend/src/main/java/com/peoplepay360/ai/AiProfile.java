package com.peoplepay360.ai;

import com.peoplepay360.common.EncryptedStringConverter;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity @Table(name = "ai_profile")
public class AiProfile {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private String name;
    @Column(nullable = false) private String provider;
    @Column(name = "base_url", nullable = false) private String baseUrl;
    @Column(nullable = false) private String model;
    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "api_key_encrypted") private String apiKey;
    @Column(name = "api_key_last4") private String apiKeyLast4;
    @Column(name = "tool_mode", nullable = false) private String toolMode = "AUTO";
    @Column(nullable = false) private BigDecimal temperature = new BigDecimal("0.20");
    @Column(name = "max_tokens", nullable = false) private int maxTokens = 1024;
    @Column(name = "is_default", nullable = false) private boolean isDefault = false;
    @Column(name = "updated_at") private OffsetDateTime updatedAt = OffsetDateTime.now();
    @Column(name = "last_test_ok") private Boolean lastTestOk;
    @Column(name = "last_test_at") private OffsetDateTime lastTestAt;
    @Column(name = "last_test_message") private String lastTestMessage;
    @Version private long version;

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
    public String getProvider() { return provider; }
    public void setProvider(String v) { this.provider = v; }
    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String v) { this.baseUrl = v; }
    public String getModel() { return model; }
    public void setModel(String v) { this.model = v; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String v) { this.apiKey = v; }
    public String getApiKeyLast4() { return apiKeyLast4; }
    public void setApiKeyLast4(String v) { this.apiKeyLast4 = v; }
    public String getToolMode() { return toolMode; }
    public void setToolMode(String v) { this.toolMode = v; }
    public BigDecimal getTemperature() { return temperature; }
    public void setTemperature(BigDecimal v) { this.temperature = v; }
    public int getMaxTokens() { return maxTokens; }
    public void setMaxTokens(int v) { this.maxTokens = v; }
    public boolean isDefault() { return isDefault; }
    public void setDefault(boolean v) { this.isDefault = v; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime v) { this.updatedAt = v; }
    public Boolean getLastTestOk() { return lastTestOk; }
    public void setLastTestOk(Boolean v) { this.lastTestOk = v; }
    public OffsetDateTime getLastTestAt() { return lastTestAt; }
    public void setLastTestAt(OffsetDateTime v) { this.lastTestAt = v; }
    public String getLastTestMessage() { return lastTestMessage; }
    public void setLastTestMessage(String v) { this.lastTestMessage = v; }
    public long getVersion() { return version; }
}
