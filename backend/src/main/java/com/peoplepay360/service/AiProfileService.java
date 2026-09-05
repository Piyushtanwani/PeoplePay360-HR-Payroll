package com.peoplepay360.service;

import com.peoplepay360.dto.AiDtos.*;
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
import com.peoplepay360.model.AiProfile;
import com.peoplepay360.repository.AiProfileRepository;

@Service
public class AiProfileService {
    private final AiProfileRepository repo;
    private final AiProviderClient providerClient;
    private final AppProperties props;
    private final CurrentUser currentUser;

    public AiProfileService(AiProfileRepository repo, AiProviderClient providerClient, AppProperties props,
                            CurrentUser currentUser) {
        this.repo = repo;
        this.providerClient = providerClient;
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
            new ProviderPreset("OPENROUTER", "OpenRouter", "https://openrouter.ai/api/v1", true, "https://openrouter.ai/keys"),
            new ProviderPreset("NVIDIA", "NVIDIA NIM", "https://integrate.api.nvidia.com/v1", true, "https://build.nvidia.com"),
            new ProviderPreset("OLLAMA", "Ollama (this machine)", "http://localhost:11434/v1", false, "https://ollama.com")
        );
    }

    @PreAuthorize("hasAuthority('ai.settings')")
    public Map<String, Object> models(ModelsRequest in) {
        String baseUrl = in.baseUrl() == null || in.baseUrl().isBlank() ? presetBaseUrl(in.provider()) : in.baseUrl();
        List<String> models = providerClient.listModels(in.provider(), baseUrl, resolveKey(in.apiKey(), in.profileId()));
        Map<String, Object> out = new HashMap<>();
        out.put("models", models);
        out.put("defaultModel", providerClient.defaultModel(in.provider(), models));
        return out;
    }

    /**
     * Paste a key, get a working assistant: fetches the model list, picks the best default,
     * saves the profile, makes it the active one and verifies it end to end.
     */
    @PreAuthorize("hasAuthority('ai.settings')")
    @Transactional
    public QuickSetupResult quickSetup(QuickSetup in) {
        String provider = in.provider() == null ? "OLLAMA" : in.provider().toUpperCase();
        String baseUrl = in.baseUrl() == null || in.baseUrl().isBlank() ? presetBaseUrl(provider) : in.baseUrl();
        String apiKey = in.apiKey() == null ? "" : in.apiKey().trim();

        List<String> models = providerClient.listModels(provider, baseUrl, apiKey);
        String chosen = in.model() == null || in.model().isBlank() ? null : in.model().trim();
        if (chosen != null && !models.isEmpty() && !models.contains(chosen)) {
            throw new ApiException(com.peoplepay360.common.ErrorCode.AI_PROVIDER_ERROR,
                    "That model is not available from this provider.");
        }
        String model = chosen != null ? chosen : providerClient.defaultModel(provider, models);
        if (model == null) {
            throw new ApiException(com.peoplepay360.common.ErrorCode.AI_PROVIDER_ERROR,
                    "The provider returned no models. For Ollama, pull a model first.");
        }

        AiProfile p = repo.findByProviderIgnoreCase(provider).orElseGet(AiProfile::new);
        p.setName(label(provider));
        p.setProvider(provider);
        p.setBaseUrl(baseUrl);
        p.setModel(model);
        if (!apiKey.isBlank()) {
            p.setApiKey(apiKey);
            p.setApiKeyLast4(apiKey.length() >= 4 ? apiKey.substring(apiKey.length() - 4) : apiKey);
        }
        if (p.getToolMode() == null) p.setToolMode("AUTO");
        if (p.getTemperature() == null) p.setTemperature(new java.math.BigDecimal("0.2"));
        if (p.getMaxTokens() == 0) p.setMaxTokens(2048);
        p.setUpdatedAt(OffsetDateTime.now());

        Map<String, Object> result = providerClient.test(provider, baseUrl, apiKey, model);
        boolean ok = Boolean.TRUE.equals(result.get("ok"));
        p.setLastTestOk(ok);
        p.setLastTestAt(OffsetDateTime.now());
        p.setLastTestMessage(String.valueOf(result.getOrDefault("message", "")));
        p = repo.save(p);

        final Long activeId = p.getId();
        repo.findAll().forEach(other -> {
            boolean shouldBeDefault = other.getId().equals(activeId);
            if (other.isDefault() != shouldBeDefault) { other.setDefault(shouldBeDefault); repo.save(other); }
        });
        p.setDefault(true);

        return new QuickSetupResult(toDto(p), models, ok, String.valueOf(result.getOrDefault("message", "")));
    }

    @PreAuthorize("hasAuthority('ai.settings')")
    @Transactional
    public Map<String, Object> test(TestRequest in) {
        String baseUrl = in.baseUrl() == null || in.baseUrl().isBlank() ? presetBaseUrl(in.provider()) : in.baseUrl();
        String model = in.model();
        if ((model == null || model.isBlank()) && in.profileId() != null) {
            model = repo.findById(in.profileId()).map(AiProfile::getModel).orElse(null);
        }
        Map<String, Object> result = providerClient.test(in.provider(), baseUrl,
                resolveKey(in.apiKey(), in.profileId()), model);
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

    private String presetBaseUrl(String provider) {
        String key = provider == null ? "" : provider.toUpperCase();
        return switch (key) {
            case "OPENROUTER" -> "https://openrouter.ai/api/v1";
            case "NVIDIA" -> "https://integrate.api.nvidia.com/v1";
            case "OLLAMA" -> "http://localhost:11434/v1";
            default -> props.getAi().getDefaultBaseUrl();
        };
    }

    private String label(String provider) {
        return switch (provider) {
            case "OPENROUTER" -> "OpenRouter";
            case "NVIDIA" -> "NVIDIA NIM";
            case "OLLAMA" -> "Ollama (this machine)";
            default -> provider;
        };
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
