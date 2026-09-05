package com.peoplepay360.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {
    /** Single-tenant display name shown on schedules and payslips. */
    private String companyName = "OXP Pvt Ltd";
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String v) { this.companyName = v; }
    /** Public base URL of the web app, used to build invite links. */
    private String appBaseUrl = "http://localhost:5173";
    public String getAppBaseUrl() { return appBaseUrl; }
    public void setAppBaseUrl(String v) { this.appBaseUrl = v; }
    private int inviteTtlHours = 48;
    public int getInviteTtlHours() { return inviteTtlHours; }
    public void setInviteTtlHours(int v) { this.inviteTtlHours = v; }


    private Jwt jwt = new Jwt();
    private Mcp mcp = new Mcp();
    private Chat chat = new Chat();
    private Ai ai = new Ai();
    private Attendance attendance = new Attendance();
    private Payroll payroll = new Payroll();
    private Security security = new Security();
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
    /**
     * Attendance classification thresholds. These are the numbers the "How attendance is
     * classified" help panel shows, so the panel can never drift from the classifier.
     */
    public static class Attendance {
        /** Minutes after the scheduled start before a check-in counts as LATE. */
        private int lateGraceMinutes = 10;
        /** Minutes worked beyond the scheduled day before it counts as OVERTIME. */
        private int overtimeThresholdMinutes = 30;
        /** Minutes after the scheduled end before an open entry is flagged MISSING_CHECKOUT. */
        private int missingCheckoutAfterMinutes = 240;
        public int getLateGraceMinutes() { return lateGraceMinutes; }
        public void setLateGraceMinutes(int v) { this.lateGraceMinutes = v; }
        public int getOvertimeThresholdMinutes() { return overtimeThresholdMinutes; }
        public void setOvertimeThresholdMinutes(int v) { this.overtimeThresholdMinutes = v; }
        public int getMissingCheckoutAfterMinutes() { return missingCheckoutAfterMinutes; }
        public void setMissingCheckoutAfterMinutes(int v) { this.missingCheckoutAfterMinutes = v; }
    }
    public static class Payroll {
        /** Percentage move in net pay against the previous payslip that raises a VARIANCE_FLAG warning. */
        private int varianceThresholdPct = 25;
        public int getVarianceThresholdPct() { return varianceThresholdPct; }
        public void setVarianceThresholdPct(int v) { this.varianceThresholdPct = v; }
    }
    public static class Security {
        /** Sign-in attempts allowed per email and per IP in a 15 minute window. */
        private int loginAttempts = 10;
        public int getLoginAttempts() { return loginAttempts; }
        public void setLoginAttempts(int v) { this.loginAttempts = v; }
    }

    public Jwt getJwt() { return jwt; }
    public void setJwt(Jwt v) { this.jwt = v; }
    public Mcp getMcp() { return mcp; }
    public void setMcp(Mcp v) { this.mcp = v; }
    public Chat getChat() { return chat; }
    public void setChat(Chat v) { this.chat = v; }
    public Ai getAi() { return ai; }
    public void setAi(Ai v) { this.ai = v; }
    public Attendance getAttendance() { return attendance; }
    public void setAttendance(Attendance v) { this.attendance = v; }
    public Payroll getPayroll() { return payroll; }
    public void setPayroll(Payroll v) { this.payroll = v; }
    public Security getSecurity() { return security; }
    public void setSecurity(Security v) { this.security = v; }
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
