package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.config.AppProperties;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.util.Map;

/** Calls the Python MCP service with the gateway secret and, for chat, the caller's delegated token. */
@Component
public class McpClient {
    private final RestClient client;
    private final String gatewaySecret;

    public McpClient(AppProperties props) {
        this.client = RestClient.builder().baseUrl(props.getMcp().getBaseUrl()).build();
        this.gatewaySecret = props.getMcp().getGatewaySecret();
    }

    public Map<String, Object> chat(Map<String, Object> body, String delegatedToken, String requestId) {
        try {
            return client.post().uri("/chat")
                    .header("X-Gateway-Secret", gatewaySecret)
                    .header("Authorization", "Bearer " + delegatedToken)
                    .header("X-Request-Id", requestId == null ? "" : requestId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);
        } catch (ResourceAccessException e) {
            throw new ApiException(ErrorCode.MCP_UNAVAILABLE, "The assistant service is unavailable.");
        } catch (Exception e) {
            throw new ApiException(ErrorCode.AI_PROVIDER_ERROR, "The assistant could not complete the request.");
        }
    }

    public Map<String, Object> tools(String delegatedToken) {
        try {
            return client.get().uri("/tools")
                    .header("X-Gateway-Secret", gatewaySecret)
                    .header("Authorization", "Bearer " + delegatedToken)
                    .retrieve().body(Map.class);
        } catch (Exception e) {
            throw new ApiException(ErrorCode.MCP_UNAVAILABLE, "The assistant service is unavailable.");
        }
    }

    public Map<String, Object> models(Map<String, Object> body) {
        return postProvider("/providers/models", body);
    }
    public Map<String, Object> test(Map<String, Object> body) {
        return postProvider("/providers/test", body);
    }
    public Map<String, Object> health() {
        try {
            return client.get().uri("/health").retrieve().body(Map.class);
        } catch (Exception e) {
            return Map.of("status", "down");
        }
    }
    private Map<String, Object> postProvider(String path, Map<String, Object> body) {
        try {
            return client.post().uri(path)
                    .header("X-Gateway-Secret", gatewaySecret)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body).retrieve().body(Map.class);
        } catch (ResourceAccessException e) {
            throw new ApiException(ErrorCode.MCP_UNAVAILABLE, "The assistant service is unavailable.");
        } catch (Exception e) {
            throw new ApiException(ErrorCode.AI_PROVIDER_ERROR, "The AI provider could not be reached.");
        }
    }
}
