package com.peoplepay360.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public class AiDtos {
    public record AiProfileDto(Long id, String name, String provider, String baseUrl, String model,
                              boolean apiKeySet, String apiKeyLast4, String toolMode, BigDecimal temperature,
                              int maxTokens, boolean isDefault, OffsetDateTime updatedAt, Boolean lastTestOk,
                              OffsetDateTime lastTestAt, String lastTestMessage) {}
    public record SaveProfile(String name, String provider, String baseUrl, String model, String apiKey,
                              String toolMode, BigDecimal temperature, Integer maxTokens) {}
    public record ProviderPreset(String provider, String label, String defaultBaseUrl, boolean requiresApiKey, String docsUrl) {}
    public record ModelsRequest(String provider, String baseUrl, String apiKey, Long profileId) {}
    public record TestRequest(String provider, String baseUrl, String apiKey, String model, Long profileId) {}
    public record ActiveProfile(Long profileId, String name, String provider, String model) {}
    /** Connect a provider. When model is null the server picks the best available one. */
    public record QuickSetup(String provider, String apiKey, String baseUrl, String model) {}
    public record QuickSetupResult(AiProfileDto profile, List<String> models, boolean ok, String message) {}
    /** Assistant availability for the signed-in user. */
    public record AssistantStatus(boolean configured, String provider, String model, boolean toolsAvailable) {}
}
