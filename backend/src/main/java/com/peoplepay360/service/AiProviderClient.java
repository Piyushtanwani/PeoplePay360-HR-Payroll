package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Talks to OpenAI-compatible providers (OpenRouter, NVIDIA NIM, Ollama) directly.
 * Tool calling still goes through the MCP service, which is a separate, later addition.
 */
@Component
public class AiProviderClient {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AiProviderClient.class);

    /** Ranked prefixes used to pick a sensible default model so the operator never has to choose one. */
    private static final Map<String, List<String>> PREFERRED = Map.of(
            "OPENROUTER", List.of("openai/gpt-4o-mini", "anthropic/claude-3.5-haiku", "google/gemini-flash", "meta-llama/llama-3.1-8b"),
            "NVIDIA", List.of("meta/llama-3.1-8b-instruct", "meta/llama-3.1-70b-instruct", "mistralai/mistral-7b-instruct"),
            "OLLAMA", List.of("llama3.1", "llama3", "qwen2.5", "mistral", "phi3"));

    private RestClient clientFor(String baseUrl, String apiKey) {
        RestClient.Builder b = RestClient.builder()
                .baseUrl(stripTrailingSlash(baseUrl))
                .requestFactory(factory());
        if (apiKey != null && !apiKey.isBlank()) b = b.defaultHeader("Authorization", "Bearer " + apiKey);
        return b.build();
    }

    private org.springframework.http.client.ClientHttpRequestFactory factory() {
        var f = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        f.setConnectTimeout((int) Duration.ofSeconds(10).toMillis());
        f.setReadTimeout((int) Duration.ofSeconds(120).toMillis());
        return f;
    }

    /** Lists the models a provider exposes, best default first. */
    @SuppressWarnings("unchecked")
    public List<String> listModels(String provider, String baseUrl, String apiKey) {
        try {
            Map<String, Object> body = clientFor(baseUrl, apiKey).get().uri("/models").retrieve().body(Map.class);
            Object data = body == null ? null : body.get("data");
            List<String> ids = new ArrayList<>();
            if (data instanceof List<?> list) {
                for (Object item : list) {
                    if (item instanceof Map<?, ?> m && m.get("id") != null) ids.add(String.valueOf(m.get("id")));
                }
            }
            ids.sort(Comparator.comparingInt(id -> rank(provider, id)));
            return ids;
        } catch (Exception e) {
            throw new ApiException(ErrorCode.AI_PROVIDER_ERROR,
                    "Could not reach the provider. Check the API key and base URL.");
        }
    }

    /** The model to use when the operator has not picked one. */
    public String defaultModel(String provider, List<String> models) {
        if (models == null || models.isEmpty()) return null;
        return models.get(0);
    }

    /** Models that cannot hold a text conversation, or are a poor default for one. */
    private static final List<String> NOT_FOR_CHAT =
            List.of("embed", "bge-", "nomic", "-vl", "vl:", "vision", "llava", "whisper", "tts", "rerank",
                    "stable-diffusion", "sdxl", "flux", "clip", "moderation", "guard");

    private boolean chatCapable(String id) {
        String lower = id.toLowerCase();
        return NOT_FOR_CHAT.stream().noneMatch(lower::contains);
    }

    /**
     * Lower is better. Non-chat models sink to the bottom so they are never the default,
     * then a newer major version of the same family wins, then the curated preference list.
     */
    private int rank(String provider, String id) {
        String lower = id.toLowerCase();
        if (!chatCapable(lower)) return 10_000;

        List<String> preferred = PREFERRED.getOrDefault(provider == null ? "" : provider.toUpperCase(), List.of());
        for (int i = 0; i < preferred.size(); i++) {
            if (lower.startsWith(preferred.get(i).toLowerCase())) return 100 + i;
        }
        // An unlisted model of a known family is usually newer than the curated entry, so rank it ahead.
        for (String p : preferred) {
            String family = p.split("[.:/-]")[0];
            if (family.length() >= 3 && lower.contains(family)) return 50;
        }
        if (lower.contains("instruct") || lower.contains("chat") || lower.contains("mini") || lower.contains("flash")) {
            return 200;
        }
        return 300;
    }

    /** One round trip used by the settings screen to confirm the credentials work. */
    public Map<String, Object> test(String provider, String baseUrl, String apiKey, String model) {
        Map<String, Object> out = new LinkedHashMap<>();
        long started = System.currentTimeMillis();
        try {
            String reply = complete(baseUrl, apiKey, model,
                    List.of(Map.of("role", "user", "content", "Reply with the single word: ready")), 0.0, 16);
            out.put("ok", true);
            out.put("message", "Connected. Model replied in " + (System.currentTimeMillis() - started) + " ms.");
            out.put("sample", reply);
        } catch (ApiException e) {
            out.put("ok", false);
            out.put("message", e.getMessage());
        } catch (Exception e) {
            out.put("ok", false);
            out.put("message", "Connection failed: " + e.getMessage());
        }
        out.put("model", model);
        return out;
    }

    /** Sends a chat completion and returns the assistant text. */
    @SuppressWarnings("unchecked")
    public String complete(String baseUrl, String apiKey, String model, List<Map<String, Object>> messages,
                           double temperature, int maxTokens) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("messages", messages);
        payload.put("temperature", temperature);
        payload.put("max_tokens", maxTokens);
        payload.put("stream", false);
        try {
            Map<String, Object> body = clientFor(baseUrl, apiKey).post().uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(Map.class);
            if (body == null) throw new ApiException(ErrorCode.AI_PROVIDER_ERROR, "The model returned an empty response.");
            Object choices = body.get("choices");
            if (choices instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> first) {
                Object message = first.get("message");
                if (message instanceof Map<?, ?> m && m.get("content") != null) return String.valueOf(m.get("content"));
                if (first.get("text") != null) return String.valueOf(first.get("text"));
            }
            throw new ApiException(ErrorCode.AI_PROVIDER_ERROR, "The model returned no message content.");
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Chat completion failed for model {}: {}", model, e.getMessage());
            throw new ApiException(ErrorCode.AI_PROVIDER_ERROR,
                    "The assistant could not reach the model. Check the AI settings.");
        }
    }

    private String stripTrailingSlash(String url) {
        if (url == null) return "";
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
