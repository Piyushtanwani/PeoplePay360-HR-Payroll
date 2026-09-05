package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Calls the assistant service.
 *
 * <p>Two headers matter. The gateway secret proves the call came from this backend rather than from a
 * browser, and the delegated token carries the permissions of whoever is chatting, so the assistant
 * can never read anything that person could not read themselves.
 */
@Component
public class McpClient {
    private static final Logger log = LoggerFactory.getLogger(McpClient.class);

    private final RestClient client;
    private final String gatewaySecret;

    public McpClient(AppProperties props) {
        // Pinned to HTTP/1.1. Left to itself the JDK client offers an h2c upgrade on every request,
        // and the assistant service speaks HTTP/1.1 only, so it rejected the whole request as malformed
        // before any handler saw it. The symptom was an empty reply with no explanation anywhere.
        java.net.http.HttpClient http = java.net.http.HttpClient.newBuilder()
                .version(java.net.http.HttpClient.Version.HTTP_1_1)
                .connectTimeout(java.time.Duration.ofSeconds(10))
                .build();
        var factory = new org.springframework.http.client.JdkClientHttpRequestFactory(http);
        // A bounded wait, because without one a stuck assistant holds a request thread forever. It is
        // generous on purpose: a local model loading its weights for the first question genuinely takes
        // minutes, and cutting it off there is indistinguishable from the service being broken.
        factory.setReadTimeout(java.time.Duration.ofMinutes(10));
        this.client = RestClient.builder()
                .baseUrl(props.getMcp().getBaseUrl())
                .requestFactory(factory)
                .build();
        this.gatewaySecret = props.getMcp().getGatewaySecret();
    }

    public Map<String, Object> chat(Map<String, Object> body, String delegatedToken, String requestId) {
        return call("/chat", () -> {
            var spec = client.post().uri("/chat")
                    .header("X-Gateway-Secret", gatewaySecret)
                    .header("Authorization", "Bearer " + delegatedToken);
            // Omitted rather than sent empty: an empty header value makes the request malformed, and
            // the server rejects the whole thing before it ever reaches the handler.
            if (requestId != null && !requestId.isBlank()) spec = spec.header("X-Request-Id", requestId);
            return spec.contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);
        });
    }

    public Map<String, Object> tools(String delegatedToken) {
        return call("/tools", () -> client.get().uri("/tools")
                .header("X-Gateway-Secret", gatewaySecret)
                .header("Authorization", "Bearer " + delegatedToken)
                .retrieve()
                .body(Map.class));
    }

    public Map<String, Object> models(Map<String, Object> body) {
        return call("/providers/models", () -> postProvider("/providers/models", body));
    }

    public Map<String, Object> test(Map<String, Object> body) {
        return call("/providers/test", () -> postProvider("/providers/test", body));
    }

    /** Liveness. Never throws: the health screen reports the service as down rather than failing. */
    public Map<String, Object> health() {
        try {
            return client.get().uri("/health").retrieve().body(Map.class);
        } catch (Exception ex) {
            return Map.of("status", "down", "detail", ex.getMessage() == null ? "unreachable" : ex.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> postProvider(String path, Map<String, Object> body) {
        return client.post().uri(path)
                .header("X-Gateway-Secret", gatewaySecret)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class);
    }

    /**
     * Runs a call and turns a failure into the right error code.
     *
     * <p>The response body is logged rather than discarded: a rejected request says exactly which field
     * it disliked, and losing that turned a five-minute fix into a guessing game.
     */
    private Map<String, Object> call(String path, java.util.function.Supplier<Map<String, Object>> action) {
        try {
            Map<String, Object> result = action.get();
            return result == null ? Map.of() : result;
        } catch (ResourceAccessException ex) {
            log.warn("Assistant service unreachable at {}: {}", path, ex.getMessage());
            throw new ApiException(ErrorCode.MCP_UNAVAILABLE, "The assistant service is unavailable.");
        } catch (org.springframework.web.client.RestClientResponseException ex) {
            log.error("Assistant service rejected {} with {}: {}", path, ex.getStatusCode(),
                    new String(ex.getResponseBodyAsByteArray(), StandardCharsets.UTF_8));
            if (ex.getStatusCode().value() == 401 || ex.getStatusCode().value() == 403) {
                throw new ApiException(ErrorCode.MCP_UNAVAILABLE,
                        "The assistant service refused this request. Check that the gateway secret matches.");
            }
            throw new ApiException(ErrorCode.AI_PROVIDER_ERROR, detailOf(ex));
        } catch (Exception ex) {
            log.error("Assistant call to {} failed: {}", path, ex.toString());
            throw new ApiException(ErrorCode.AI_PROVIDER_ERROR,
                    "The assistant could not complete the request: " + ex.getMessage());
        }
    }

    /**
     * Pulls the assistant service's own explanation out of the error body.
     *
     * <p>A model that was withdrawn, a key that expired and a prompt that exceeded the context window
     * all arrive here, and each needs a different fix. One shared message hides all three.
     */
    private String detailOf(org.springframework.web.client.RestClientResponseException ex) {
        try {
            String raw = new String(ex.getResponseBodyAsByteArray(), StandardCharsets.UTF_8);
            if (!raw.isBlank()) {
                com.fasterxml.jackson.databind.JsonNode node =
                        new com.fasterxml.jackson.databind.ObjectMapper().readTree(raw);
                for (String field : new String[] {"detail", "message", "error"}) {
                    com.fasterxml.jackson.databind.JsonNode value = node.path(field);
                    if (value.isTextual() && !value.asText().isBlank()) return value.asText();
                }
            }
        } catch (Exception ignored) {
            // Fall through to the status-only message below.
        }
        return "The assistant service returned HTTP " + ex.getStatusCode().value() + ".";
    }
}
