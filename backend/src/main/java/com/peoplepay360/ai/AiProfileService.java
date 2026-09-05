package com.peoplepay360.ai;

import com.peoplepay360.ai.AiDtos.*;
import com.peoplepay360.common.ApiException;
import com.peoplepay360.config.AppProperties;
import com.peoplepay360.security.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AiProfileService {
    private final AiProfileRepository repo;
    private final McpClient mcp;
    private final AppProperties props;
    private final CurrentUser currentUser;

    public AiProfileService(AiProfileRepository repo, McpClient mcp, AppProperties props, CurrentUser currentUser) {
        this.repo = repo;
        this.mcp = mcp;
        this.props = props;
        this.currentUser = currentUser;
    }

    @PreAuthorize("hasAuthority('ai.settings')")
    @Transactional(readOnly = true)
    public List<AiProfileDto> list() { return repo.findAll().stream().map(this::toDto).toList(); }

    @PreAuthorize("hasAuthority('ai.settings')")
    @Transactional
    public AiProfileDto create(SaveProfile in) {
        AiProfile p = new AiProfile();
        apply(p, in, true);
        if (repo.findByIsDefaultTrue().isEmpty()) p.setDefault(true);
        return toDto(repo.save(p));
    }

    @PreAuthorize("hasAuthority('ai.settings')")
    @Transactional
    public AiProfileDto update(Long id, SaveProfile in) {
        AiProfile p = repo.findById(id).orElseThrow(() -> ApiException.notFound("profile"));
        apply(p, in, false);
        p.setUpdatedAt(OffsetDateTime.now());
        return toDto(repo.save(p));
    }

    @PreAuthorize("hasAuthority('ai.settings')")
    @Transactional
    public void delete(Long id) { repo.deleteById(id); }

    @PreAuthorize("hasAuthority('ai.settings')")
    @Transactional
    public AiProfileDto setDefault(Long id) {
        repo.findAll().forEach(p -> { p.setDefault(false); repo.save(p); });
        AiProfile p = repo.findById(id).orElseThrow(() -> ApiException.notFound("profile"));
        p.setDefault(true);
        return toDto(repo.save(p));
    }

    @PreAuthorize("hasAuthority('ai.settings')")
    public List<ProviderPreset> providers() {
        return List.of(
            new ProviderPreset("OPENROUTER", "OpenRouter", "https://openrouter.ai/api/v1", true, "https://openrouter.ai/docs"),
            new ProviderPreset("NVIDIA", "NVIDIA NIM", "https://integrate.api.nvidia.com/v1", true, "https://docs.nvidia.com"),
            new ProviderPreset("OLLAMA", "Ollama (local)", "http://host.docker.internal:11434/v1", false, "https://ollama.com")
        );
    }

    @PreAuthorize("hasAuthority('ai.settings')")
    public Map<String, Object> models(ModelsRequest in) {
        Map<String, Object> body = new HashMap<>();
        body.put("provider", in.provider());
        body.put("baseUrl", in.baseUrl());
        body.put("apiKey", resolveKey(in.apiKey(), in.profileId()));
        return mcp.models(body);
    }

    @PreAuthorize("hasAuthority('ai.settings')")
    @Transactional
    public Map<String, Object> test(TestRequest in) {
        Map<String, Object> body = new HashMap<>();
        body.put("provider", in.provider());
        body.put("baseUrl", in.baseUrl());
        body.put("apiKey", resolveKey(in.apiKey(), in.profileId()));
        body.put("model", in.model());
        Map<String, Object> result = mcp.test(body);
        if (in.profileId() != null) {
            repo.findById(in.profileId()).ifPresent(p -> {
                p.setLastTestOk(Boolean.TRUE.equals(result.get("ok")));
                p.setLastTestAt(OffsetDateTime.now());
                p.setLastTestMessage(String.valueOf(result.getOrDefault("message", "")));
                repo.save(p);
            });
        }
        return result;
    }

    @PreAuthorize("hasAuthority('chat.access')")
    @Transactional(readOnly = true)
    public ActiveProfile active() {
        AiProfile p = repo.findByIsDefaultTrue().orElse(null);
        if (p == null) return new ActiveProfile(null, "None", props.getAi().getDefaultProvider(), props.getAi().getDefaultModel());
        return new ActiveProfile(p.getId(), p.getName(), p.getProvider(), p.getModel());
    }

    // internal use by chat gateway
    public AiProfile resolveForChat(Long overrideId) {
        if (overrideId != null && currentUser.hasAuthority("ai.settings")) {
            return repo.findById(overrideId).orElseThrow(() -> ApiException.notFound("profile"));
        }
        return repo.findByIsDefaultTrue().orElseThrow(() ->
                new ApiException(com.peoplepay360.common.ErrorCode.MCP_UNAVAILABLE, "No AI profile is configured."));
    }

    private String resolveKey(String provided, Long profileId) {
        if (provided != null && !provided.isBlank()) return provided;
        if (profileId != null) return repo.findById(profileId).map(AiProfile::getApiKey).orElse("");
        return "";
    }
    private void apply(AiProfile p, SaveProfile in, boolean isNew) {
        if (in.name() != null) p.setName(in.name());
        if (in.provider() != null) p.setProvider(in.provider());
        if (in.baseUrl() != null) p.setBaseUrl(in.baseUrl());
        if (in.model() != null) p.setModel(in.model());
        if (in.toolMode() != null) p.setToolMode(in.toolMode());
        if (in.temperature() != null) p.setTemperature(in.temperature());
        if (in.maxTokens() != null) p.setMaxTokens(in.maxTokens());
        if (in.apiKey() != null && !in.apiKey().isBlank()) {
            p.setApiKey(in.apiKey());
            String k = in.apiKey();
            p.setApiKeyLast4(k.length() >= 4 ? k.substring(k.length() - 4) : k);
        }
    }
    private AiProfileDto toDto(AiProfile p) {
        return new AiProfileDto(p.getId(), p.getName(), p.getProvider(), p.getBaseUrl(), p.getModel(),
                p.getApiKey() != null && !p.getApiKey().isBlank(), p.getApiKeyLast4(), p.getToolMode(),
                p.getTemperature(), p.getMaxTokens(), p.isDefault(), p.getUpdatedAt(), p.getLastTestOk(),
                p.getLastTestAt(), p.getLastTestMessage());
    }
}
