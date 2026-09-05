package com.peoplepay360.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Talks to OpenAI-compatible providers: OpenRouter, NVIDIA NIM and Ollama.
 *
 * <p>Every failure here is reported with what the provider actually said. A generic "check the AI
 * settings" is useless when the real problem is a missing key, a model that was withdrawn, or a
 * spending limit, and those need three different actions.
 */
@Component
public class AiProviderClient {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AiProviderClient.class);

    /** Providers that will not answer at all without a key, so the absence is worth catching early. */
    private static final Set<String> NEEDS_KEY = Set.of("OPENROUTER", "NVIDIA");

    /** Ranked prefixes used to pick a sensible default, so an operator never has to choose one. */
    private static final Map<String, List<String>> PREFERRED = Map.of(
            "OPENROUTER", List.of("openai/gpt-4o-mini", "anthropic/claude-3.5-haiku", "google/gemini-flash",
                    "meta-llama/llama-3.1-8b"),
            // NVIDIA retires models on a published schedule, so this list holds families rather than
            // one pinned name; anything withdrawn simply drops out of the catalogue and is skipped.
            "NVIDIA", List.of("nvidia/llama-3.1-nemotron-70b-instruct", "mistralai/mistral-nemotron",
                    "mistralai/mistral-7b-instruct", "meta/llama-3.3-70b-instruct"),
            "OLLAMA", List.of("qwen3", "llama3.1", "llama3", "qwen2.5", "mistral", "phi3"));

    /**
     * Families known to handle tool calling well. The assistant is only useful when the model can call
     * tools, so one that can is always a better default than one that cannot.
     */
    private static final List<String> TOOL_CAPABLE =
            List.of("qwen3", "qwen2.5", "llama3.1", "llama3.2", "llama-3.1", "llama-3.3", "mistral",
                    "nemotron", "gpt-4", "gpt-4o", "claude", "gemini", "command-r", "firefunction", "hermes");

    /** Models that cannot hold a text conversation, or make a poor default for one. */
    private static final List<String> NOT_FOR_CHAT =
            List.of("embed", "bge-", "nomic", "-vl", "vl:", "vision", "llava", "whisper", "tts", "rerank",
                    "stable-diffusion", "sdxl", "flux", "clip", "moderation", "guard", "reranker",
                    "safety", "reward", "parse", "topic-control", "ocr", "asr", "speech");

    /**
     * Reasoning models emit a long private monologue before answering. They work, but they are slow and
     * unreliable at tool calling, so they are never chosen automatically.
     */
    private static final List<String> REASONING_FIRST = List.of("deepseek-r1", "-r1:", "qwq", "marco-o1", "o1-", "o3-");

    private final ObjectMapper mapper;

    public AiProviderClient(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    private RestClient clientFor(String baseUrl, String apiKey) {
        RestClient.Builder builder = RestClient.builder()
                .baseUrl(stripTrailingSlash(baseUrl))
                .requestFactory(factory());
        if (apiKey != null && !apiKey.isBlank()) {
            builder = builder.defaultHeader("Authorization", "Bearer " + apiKey);
        }
        // OpenRouter attributes traffic by these headers and rate limits harder without them.
        return builder
                .defaultHeader("HTTP-Referer", "https://peoplepay360.local")
                .defaultHeader("X-Title", "PeoplePay360")
                .build();
    }

    private org.springframework.http.client.ClientHttpRequestFactory factory() {
        var f = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        f.setConnectTimeout((int) Duration.ofSeconds(10).toMillis());
        f.setReadTimeout((int) Duration.ofSeconds(180).toMillis());
        return f;
    }

    /** Lists the models a provider exposes, best default first. */
    @SuppressWarnings("unchecked")
    public List<String> listModels(String provider, String baseUrl, String apiKey) {
        String key = provider == null ? "" : provider.toUpperCase();
        try {
            Map<String, Object> body = clientFor(baseUrl, apiKey).get().uri("/models").retrieve().body(Map.class);
            Object data = body == null ? null : body.get("data");
            List<String> ids = new ArrayList<>();
            if (data instanceof List<?> list) {
                for (Object item : list) {
                    if (item instanceof Map<?, ?> m && m.get("id") != null) ids.add(String.valueOf(m.get("id")));
                }
            }
            ids.sort(Comparator.comparingInt(id -> rank(key, id)));
            return ids;
        } catch (RestClientResponseException ex) {
            throw new ApiException(ErrorCode.AI_PROVIDER_ERROR, explain(key, apiKey, ex));
        } catch (Exception ex) {
            log.warn("Could not list models for {} at {}: {}", key, baseUrl, ex.getMessage());
            throw new ApiException(ErrorCode.AI_PROVIDER_ERROR,
                    "Could not reach " + label(key) + " at " + baseUrl + ". " + hint(key));
        }
    }

    /** The model to use when the operator has not picked one. */
    public String defaultModel(String provider, List<String> models) {
        if (models == null || models.isEmpty()) return null;
        return models.get(0);
    }

    private boolean chatCapable(String id) {
        return NOT_FOR_CHAT.stream().noneMatch(id::contains);
    }

    /**
     * Lower is better. Anything that cannot hold a conversation sinks to the bottom, then models that
     * cannot call tools, then reasoning models, then the curated preference list.
     */
    private int rank(String provider, String id) {
        String lower = id.toLowerCase();
        if (!chatCapable(lower)) return 10_000;
        // A reasoning model answers eventually but is a poor automatic choice for a tool-calling assistant.
        if (REASONING_FIRST.stream().anyMatch(lower::contains)) return 5_000;
        if (TOOL_CAPABLE.stream().noneMatch(lower::contains)) return 1_000;

        List<String> preferred = PREFERRED.getOrDefault(provider, List.of());
        for (int i = 0; i < preferred.size(); i++) {
            if (lower.startsWith(preferred.get(i).toLowerCase())) return 100 + i;
        }
        for (String p : preferred) {
            String family = p.split("[.:/-]")[0];
            if (family.length() >= 3 && lower.contains(family)) return 150;
        }
        if (lower.contains("instruct") || lower.contains("chat") || lower.contains("mini") || lower.contains("flash")) {
            return 200;
        }
        return 300;
    }

    /** One round trip used by the settings screen to confirm the credentials and model work. */
    public Map<String, Object> test(String provider, String baseUrl, String apiKey, String model) {
        Map<String, Object> out = new LinkedHashMap<>();
        long started = System.currentTimeMillis();
        try {
            // A generous response limit: a reasoning model spends most of its budget thinking, and a
            // truncated reply would fail a test that the provider would actually have passed.
            String reply = complete(baseUrl, apiKey, model,
                    List.of(Map.of("role", "user", "content", "Reply with the single word: ready")), 0.0, 512);
            long elapsed = System.currentTimeMillis() - started;
            // An empty reply is a failed test, not a passing one. It means the model answered with
            // nothing usable, which is exactly what a chat turn would then do.
            if (reply == null || reply.isBlank()) {
                out.put("ok", false);
                out.put("message", "The model connected but returned no text. It may be a reasoning model "
                        + "that needs a larger response limit, or one that cannot chat.");
            } else {
                out.put("ok", true);
                out.put("message", "Connected. " + model + " replied in " + elapsed + " ms.");
                out.put("sample", reply.length() > 120 ? reply.substring(0, 120) + "…" : reply);
            }
        } catch (ApiException ex) {
            out.put("ok", false);
            out.put("message", ex.getMessage());
        } catch (Exception ex) {
            out.put("ok", false);
            out.put("message", "Connection failed: " + ex.getMessage());
        }
        out.put("model", model);
        out.put("latencyMs", System.currentTimeMillis() - started);
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
            if (body == null) {
                throw new ApiException(ErrorCode.AI_PROVIDER_ERROR, "The model returned an empty response.");
            }
            Object choices = body.get("choices");
            if (choices instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> first) {
                Object message = first.get("message");
                if (message instanceof Map<?, ?> m) {
                    Object content = m.get("content");
                    String text = stripReasoning(content);
                    if (!text.isBlank()) return text;
                    // Reasoning models put the answer here when the response limit cut the reply short.
                    String reasoning = stripReasoning(m.get("reasoning"));
                    if (!reasoning.isBlank()) return reasoning;
                }
                if (first.get("text") != null) return String.valueOf(first.get("text"));
            }
            throw new ApiException(ErrorCode.AI_PROVIDER_ERROR, "The model returned no message content.");
        } catch (ApiException ex) {
            throw ex;
        } catch (RestClientResponseException ex) {
            throw new ApiException(ErrorCode.AI_PROVIDER_ERROR, explain(providerOf(baseUrl), apiKey, ex));
        } catch (Exception ex) {
            log.warn("Chat completion failed for model {}: {}", model, ex.getMessage());
            throw new ApiException(ErrorCode.AI_PROVIDER_ERROR,
                    "Could not reach the model at " + baseUrl + ". " + ex.getMessage());
        }
    }

    /**
     * Removes the private monologue a reasoning model wraps in think tags, which is not an answer
     * and must never be shown to a user.
     */
    private String stripReasoning(Object content) {
        if (content == null) return "";
        return String.valueOf(content)
                .replaceAll("(?s)<think>.*?</think>", "")
                .replaceAll("(?s)<think>.*", "")
                .trim();
    }

    /**
     * Turns a provider's own error into something the operator can act on.
     *
     * <p>A 401 with no key set means "add a key". A 401 with one set means "that key is wrong". A 404
     * means the model name is not offered. Reporting all three identically is what makes AI settings
     * feel unfixable.
     */
    private String explain(String provider, String apiKey, RestClientResponseException ex) {
        int status = ex.getStatusCode().value();
        String detail = providerMessage(ex);
        boolean keyMissing = apiKey == null || apiKey.isBlank();

        if (status == 401 || status == 403) {
            if (NEEDS_KEY.contains(provider) && keyMissing) {
                return label(provider) + " needs an API key. " + hint(provider);
            }
            return label(provider) + " rejected the API key" + (detail.isBlank() ? "." : ": " + detail);
        }
        if (status == 404) {
            return "That model is not offered by " + label(provider) + (detail.isBlank() ? "." : ": " + detail);
        }
        if (status == 402) {
            return label(provider) + " reports no remaining credit" + (detail.isBlank() ? "." : ": " + detail);
        }
        if (status == 429) {
            return label(provider) + " is rate limiting this key. Wait a moment and try again.";
        }
        return label(provider) + " returned HTTP " + status + (detail.isBlank() ? "." : ": " + detail);
    }

    /** The message field out of an OpenAI-style error body, which is where the useful part lives. */
    private String providerMessage(RestClientResponseException ex) {
        try {
            String raw = new String(ex.getResponseBodyAsByteArray(), StandardCharsets.UTF_8);
            if (raw.isBlank()) return "";
            JsonNode node = mapper.readTree(raw);
            JsonNode message = node.path("error").path("message");
            if (message.isTextual()) return message.asText();
            if (node.path("message").isTextual()) return node.path("message").asText();
            return raw.length() > 200 ? raw.substring(0, 200) : raw;
        } catch (Exception ignored) {
            return "";
        }
    }

    private String providerOf(String baseUrl) {
        String url = baseUrl == null ? "" : baseUrl.toLowerCase();
        if (url.contains("openrouter")) return "OPENROUTER";
        if (url.contains("nvidia")) return "NVIDIA";
        if (url.contains("localhost") || url.contains("127.0.0.1") || url.contains("11434")) return "OLLAMA";
        return "";
    }

    private String label(String provider) {
        return switch (provider) {
            case "OPENROUTER" -> "OpenRouter";
            case "NVIDIA" -> "NVIDIA NIM";
            case "OLLAMA" -> "Ollama";
            default -> "The provider";
        };
    }

    private String hint(String provider) {
        return switch (provider) {
            case "OPENROUTER" -> "Create one at openrouter.ai/keys and paste it here.";
            case "NVIDIA" -> "Create one at build.nvidia.com and paste it here.";
            case "OLLAMA" -> "Check that Ollama is running on this machine, and that a model has been pulled.";
            default -> "Check the base URL and API key.";
        };
    }

    private String stripTrailingSlash(String url) {
        if (url == null) return "";
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
