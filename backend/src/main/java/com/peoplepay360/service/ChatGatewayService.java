package com.peoplepay360.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.peoplepay360.model.AiProfile;
import com.peoplepay360.service.AiProfileService;
import com.peoplepay360.service.McpClient;
import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.common.RequestContext;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.config.AppProperties;
import com.peoplepay360.model.Employee;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.model.AppUser;
import com.peoplepay360.repository.AppUserRepository;
import com.peoplepay360.repository.EffectivePermissionRepository;
import com.peoplepay360.security.ChatRateLimiter;
import com.peoplepay360.security.CurrentUser;
import com.peoplepay360.security.JwtService;
import com.peoplepay360.security.OwnershipGuard;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import com.peoplepay360.model.ChatMessage;
import com.peoplepay360.model.ChatSession;
import com.peoplepay360.model.ChatToolCall;
import com.peoplepay360.repository.ChatMessageRepository;
import com.peoplepay360.repository.ChatSessionRepository;
import com.peoplepay360.repository.ChatToolCallRepository;

/** Orchestrates a chat turn: mints a delegated token, calls the MCP service, persists messages and tool events. */
@Service
public class ChatGatewayService {
    private final ChatSessionRepository sessions;
    private final ChatMessageRepository messages;
    private final ChatToolCallRepository toolCalls;
    private final AppUserRepository users;
    private final EffectivePermissionRepository effective;
    private final EmployeeRepository employees;
    private final JwtService jwtService;
    private final AiProfileService aiProfiles;
    private final McpClient mcp;
    private final ChatRateLimiter rateLimiter;
    private final CurrentUser currentUser;
    private final OwnershipGuard ownershipGuard;
    private final AuditService audit;
    private final AppProperties props;
    private final ObjectMapper mapper;

    public ChatGatewayService(ChatSessionRepository sessions, ChatMessageRepository messages,
                              ChatToolCallRepository toolCalls, AppUserRepository users,
                              EffectivePermissionRepository effective, EmployeeRepository employees,
                              JwtService jwtService, AiProfileService aiProfiles, McpClient mcp,
                              ChatRateLimiter rateLimiter, CurrentUser currentUser, OwnershipGuard ownershipGuard,
                              AuditService audit, AppProperties props, ObjectMapper mapper) {
        this.sessions = sessions;
        this.messages = messages;
        this.toolCalls = toolCalls;
        this.users = users;
        this.effective = effective;
        this.employees = employees;
        this.jwtService = jwtService;
        this.aiProfiles = aiProfiles;
        this.mcp = mcp;
        this.rateLimiter = rateLimiter;
        this.currentUser = currentUser;
        this.ownershipGuard = ownershipGuard;
        this.audit = audit;
        this.props = props;
        this.mapper = mapper;
    }

    public record SessionDto(Long id, String title, OffsetDateTime startedAt, OffsetDateTime lastMessageAt, int messageCount) {}
    public record ToolCallDto(String toolName, boolean allowed, String denialCode, Integer latencyMs,
                              String resourceType, String resourceId) {}
    public record MessageDto(Long id, String role, String content, OffsetDateTime createdAt,
                             List<Object> blocks, List<ToolCallDto> toolCalls) {}

    @Transactional
    public SessionDto createSession(String title) {
        ChatSession s = new ChatSession();
        s.setUserId(currentUser.userId());
        s.setTitle(title == null ? "New chat" : title);
        s = sessions.save(s);
        return toSession(s);
    }

    @Transactional(readOnly = true)
    public List<SessionDto> listSessions(Long userId) {
        Long target = userId != null && currentUser.hasAuthority("chat.admin") ? userId : currentUser.userId();
        return sessions.findByUserIdAndDeletedAtIsNullOrderByStartedAtDesc(target).stream()
                .map(this::toSession).toList();
    }

    @Transactional(readOnly = true)
    public List<MessageDto> listMessages(Long sessionId) {
        ChatSession s = requireSession(sessionId);
        ownershipGuard.requireOwnUserOr404(s.getUserId(), "chat.admin", "chat_session", sessionId);
        return messages.findBySessionIdOrderByCreatedAtAsc(sessionId).stream().map(this::toMessage).toList();
    }

    @Transactional
    public void deleteSession(Long sessionId) {
        ChatSession s = requireSession(sessionId);
        ownershipGuard.requireOwnUserOr404(s.getUserId(), null, "chat_session", sessionId);
        s.setDeletedAt(OffsetDateTime.now());
    }

    @Transactional
    public MessageDto sendMessage(Long sessionId, String content, Long aiProfileId) {
        ChatSession s = requireSession(sessionId);
        ownershipGuard.requireOwnUserOr404(s.getUserId(), null, "chat_session", sessionId);
        if (!rateLimiter.tryConsume(currentUser.userId())) {
            throw new ApiException(ErrorCode.RATE_LIMITED, "You are sending messages too quickly. Please wait.");
        }
        AppUser user = users.findById(currentUser.userId()).orElseThrow(() -> ApiException.notFound("user"));

        ChatMessage userMsg = new ChatMessage();
        userMsg.setSessionId(sessionId);
        userMsg.setRole("user");
        userMsg.setContent(content);
        messages.save(userMsg);

        List<String> perms = effective.findCodesByUserId(user.getId());
        AiProfile profile = aiProfiles.resolveForChat(aiProfileId);

        String token = jwtService.mintDelegatedToken(user, sessionId, perms);
        Map<String, Object> body = buildBody(user, perms, profile, sessionId);
        Map<String, Object> resp = mcp.chat(body, token, RequestContext.getRequestId());

        Map<String, Object> reply = asMap(resp.get("reply"));
        String replyContent = reply == null ? "" : String.valueOf(reply.getOrDefault("content", ""));
        Object blocks = reply == null ? List.of() : reply.getOrDefault("blocks", List.of());

        ChatMessage asst = new ChatMessage();
        asst.setSessionId(sessionId);
        asst.setRole("assistant");
        asst.setContent(replyContent);
        try { asst.setBlocksJson(mapper.writeValueAsString(blocks)); } catch (Exception ignored) {}
        asst = messages.save(asst);

        List<?> events = resp.get("toolEvents") instanceof List<?> l ? l : List.of();
        for (Object ev : events) {
            Map<String, Object> e = asMap(ev);
            if (e == null) continue;
            ChatToolCall tc = new ChatToolCall();
            tc.setMessageId(asst.getId());
            tc.setToolName(String.valueOf(e.getOrDefault("toolName", "unknown")));
            tc.setAllowed(Boolean.TRUE.equals(e.get("allowed")));
            tc.setDenialCode(e.get("denialCode") == null ? null : String.valueOf(e.get("denialCode")));
            tc.setResourceType(e.get("resourceType") == null ? null : String.valueOf(e.get("resourceType")));
            tc.setResourceId(e.get("resourceId") == null ? null : String.valueOf(e.get("resourceId")));
            tc.setHttpStatus(asInt(e.get("httpStatus")));
            tc.setLatencyMs(asInt(e.get("latencyMs")));
            toolCalls.save(tc);
            if (!tc.isAllowed()) {
                audit.record(Channel.CHAT, "TOOL_" + tc.getToolName(), tc.getResourceType(), tc.getResourceId(),
                        "DENY", tc.getDenialCode(), null, null);
            }
        }

        s.setLastMessageAt(OffsetDateTime.now());
        return toMessage(asst);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> capabilities() {
        AppUser user = users.findById(currentUser.userId()).orElseThrow(() -> ApiException.notFound("user"));
        List<String> perms = effective.findCodesByUserId(user.getId());
        String token = jwtService.mintDelegatedToken(user, null, perms);
        return mcp.tools(token);
    }

    // ---- helpers ----
    private Map<String, Object> buildBody(AppUser user, List<String> perms, AiProfile profile, Long sessionId) {
        List<ChatMessage> history = messages.findBySessionIdOrderByCreatedAtAsc(sessionId);
        List<Map<String, Object>> msgs = new ArrayList<>();
        int start = Math.max(0, history.size() - 20);
        for (int i = start; i < history.size(); i++) {
            ChatMessage m = history.get(i);
            msgs.add(Map.of("role", m.getRole(), "content", m.getContent()));
        }
        String employeeNo = user.getEmployeeId() == null ? null :
                employees.findById(user.getEmployeeId()).map(Employee::getEmployeeNo).orElse(null);
        Map<String, Object> userBlock = new HashMap<>();
        userBlock.put("userId", user.getId());
        userBlock.put("employeeNo", employeeNo);
        userBlock.put("roleCode", user.getRole().getCode());
        userBlock.put("permissions", perms);
        userBlock.put("displayNameForUi", user.getDisplayName());

        Map<String, Object> provider = new HashMap<>();
        provider.put("provider", profile.getProvider());
        provider.put("baseUrl", profile.getBaseUrl());
        provider.put("apiKey", profile.getApiKey() == null ? "" : profile.getApiKey());
        provider.put("model", profile.getModel());
        provider.put("toolMode", profile.getToolMode());
        provider.put("temperature", profile.getTemperature());
        provider.put("maxTokens", profile.getMaxTokens());

        Map<String, Object> body = new HashMap<>();
        body.put("sessionId", sessionId);
        body.put("messages", msgs);
        body.put("user", userBlock);
        body.put("provider", provider);
        body.put("limits", Map.of("maxToolCalls", props.getChat().getMaxToolCallsPerTurn(), "timeoutSeconds", 90));
        body.put("locale", "en");
        return body;
    }

    private ChatSession requireSession(Long id) {
        return sessions.findById(id)
                .filter(s -> s.getDeletedAt() == null)
                .orElseThrow(() -> ApiException.notFound("chat session"));
    }
    private SessionDto toSession(ChatSession s) {
        int count = messages.findBySessionIdOrderByCreatedAtAsc(s.getId()).size();
        return new SessionDto(s.getId(), s.getTitle(), s.getStartedAt(), s.getLastMessageAt(), count);
    }
    @SuppressWarnings("unchecked")
    private MessageDto toMessage(ChatMessage m) {
        List<Object> blocks = List.of();
        if (m.getBlocksJson() != null) {
            try { blocks = mapper.readValue(m.getBlocksJson(), List.class); } catch (Exception ignored) {}
        }
        List<ToolCallDto> calls = toolCalls.findByMessageId(m.getId()).stream()
                .map(tc -> new ToolCallDto(tc.getToolName(), tc.isAllowed(), tc.getDenialCode(),
                        tc.getLatencyMs(), tc.getResourceType(), tc.getResourceId()))
                .toList();
        return new MessageDto(m.getId(), m.getRole(), m.getContent(), m.getCreatedAt(), blocks, calls);
    }
    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object o) { return o instanceof Map ? (Map<String, Object>) o : null; }
    private Integer asInt(Object o) { return o instanceof Number n ? n.intValue() : null; }
}
