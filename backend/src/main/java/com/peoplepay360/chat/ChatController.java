package com.peoplepay360.chat;

import com.peoplepay360.chat.ChatGatewayService.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@PreAuthorize("hasAuthority('chat.access')")
public class ChatController {
    private final ChatGatewayService service;
    public ChatController(ChatGatewayService service) { this.service = service; }

    @GetMapping("/sessions")
    public List<SessionDto> sessions(@RequestParam(required = false) Long userId) {
        return service.listSessions(userId);
    }
    @PostMapping("/sessions")
    public SessionDto create(@RequestBody(required = false) Map<String, String> body) {
        return service.createSession(body == null ? null : body.get("title"));
    }
    @GetMapping("/sessions/{id}/messages")
    public List<MessageDto> messages(@PathVariable Long id) { return service.listMessages(id); }
    @DeleteMapping("/sessions/{id}")
    public void delete(@PathVariable Long id) { service.deleteSession(id); }
    @PostMapping("/sessions/{id}/messages")
    public MessageDto send(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String content = String.valueOf(body.getOrDefault("content", ""));
        Long aiProfileId = body.get("aiProfileId") instanceof Number n ? n.longValue() : null;
        return service.sendMessage(id, content, aiProfileId);
    }
    @GetMapping("/capabilities")
    public Map<String, Object> capabilities() { return service.capabilities(); }
}
