package com.peoplepay360.controller;

import com.peoplepay360.dto.AiDtos.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import com.peoplepay360.service.AiProfileService;

@RestController
@RequestMapping("/api/admin/ai")
public class AiAdminController {
    private final AiProfileService service;
    public AiAdminController(AiProfileService service) { this.service = service; }

    @GetMapping("/profiles")
    public List<AiProfileDto> profiles() { return service.list(); }
    @PostMapping("/profiles")
    public AiProfileDto create(@RequestBody SaveProfile in) { return service.create(in); }
    @PutMapping("/profiles/{id}")
    public AiProfileDto update(@PathVariable Long id, @RequestBody SaveProfile in) { return service.update(id, in); }
    @DeleteMapping("/profiles/{id}")
    public void delete(@PathVariable Long id) { service.delete(id); }
    @PostMapping("/profiles/{id}/default")
    public AiProfileDto setDefault(@PathVariable Long id) { return service.setDefault(id); }
    @GetMapping("/providers")
    public List<ProviderPreset> providers() { return service.providers(); }
    @PostMapping("/models")
    public Map<String, Object> models(@RequestBody ModelsRequest in) { return service.models(in); }
    @PostMapping("/test")
    public Map<String, Object> test(@RequestBody TestRequest in) { return service.test(in); }
    @GetMapping("/active")
    public ActiveProfile active() { return service.active(); }
}
