package com.peoplepay360.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private Jwt jwt = new Jwt();
    private Mcp mcp = new Mcp();
    private Chat chat = new Chat();
    private Ai ai = new Ai();
    private String encryptionKey;
    private String currency = "INR";
    private String timezone = "Asia/Kolkata";
    private String corsAllowedOrigins = "";
    private String mailFrom = "payroll@peoplepay360.local";
    private String env = "dev";

    public static class Jwt {
        private String issuer = "peoplepay360";
        private String rsaPrivateKeyPem = "";
        private long accessTtlSeconds = 43200;
        private long delegatedTtlSeconds = 300;
        private String keyPath = "./keys/jwt.pem";
        public String getIssuer() { return issuer; }
        public void setIssuer(String v) { this.issuer = v; }
        public String getRsaPrivateKeyPem() { return rsaPrivateKeyPem; }
        public void setRsaPrivateKeyPem(String v) { this.rsaPrivateKeyPem = v; }
        public long getAccessTtlSeconds() { return accessTtlSeconds; }
        public void setAccessTtlSeconds(long v) { this.accessTtlSeconds = v; }
        public long getDelegatedTtlSeconds() { return delegatedTtlSeconds; }
        public void setDelegatedTtlSeconds(long v) { this.delegatedTtlSeconds = v; }
        public String getKeyPath() { return keyPath; }
        public void setKeyPath(String v) { this.keyPath = v; }
    }
    public static class Mcp {
        private String baseUrl = "http://localhost:8000";
        private String gatewaySecret = "";
        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String v) { this.baseUrl = v; }
        public String getGatewaySecret() { return gatewaySecret; }
        public void setGatewaySecret(String v) { this.gatewaySecret = v; }
    }
    public static class Chat {
        private int rateLimitPer10Min = 30;
        private int maxToolCallsPerTurn = 8;
        public int getRateLimitPer10Min() { return rateLimitPer10Min; }
        public void setRateLimitPer10Min(int v) { this.rateLimitPer10Min = v; }
        public int getMaxToolCallsPerTurn() { return maxToolCallsPerTurn; }
        public void setMaxToolCallsPerTurn(int v) { this.maxToolCallsPerTurn = v; }
    }
    public static class Ai {
        private String defaultProvider = "OLLAMA";
        private String defaultBaseUrl = "http://host.docker.internal:11434/v1";
        private String defaultApiKey = "";
        private String defaultModel = "llama3.1:8b";
        public String getDefaultProvider() { return defaultProvider; }
        public void setDefaultProvider(String v) { this.defaultProvider = v; }
        public String getDefaultBaseUrl() { return defaultBaseUrl; }
        public void setDefaultBaseUrl(String v) { this.defaultBaseUrl = v; }
        public String getDefaultApiKey() { return defaultApiKey; }
        public void setDefaultApiKey(String v) { this.defaultApiKey = v; }
        public String getDefaultModel() { return defaultModel; }
        public void setDefaultModel(String v) { this.defaultModel = v; }
    }
    public Jwt getJwt() { return jwt; }
    public void setJwt(Jwt v) { this.jwt = v; }
    public Mcp getMcp() { return mcp; }
    public void setMcp(Mcp v) { this.mcp = v; }
    public Chat getChat() { return chat; }
    public void setChat(Chat v) { this.chat = v; }
    public Ai getAi() { return ai; }
    public void setAi(Ai v) { this.ai = v; }
    public String getEncryptionKey() { return encryptionKey; }
    public void setEncryptionKey(String v) { this.encryptionKey = v; }
    public String getCurrency() { return currency; }
    public void setCurrency(String v) { this.currency = v; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String v) { this.timezone = v; }
    public String getCorsAllowedOrigins() { return corsAllowedOrigins; }
    public void setCorsAllowedOrigins(String v) { this.corsAllowedOrigins = v; }
    public String getMailFrom() { return mailFrom; }
    public void setMailFrom(String v) { this.mailFrom = v; }
    public String getEnv() { return env; }
    public void setEnv(String v) { this.env = v; }
}
