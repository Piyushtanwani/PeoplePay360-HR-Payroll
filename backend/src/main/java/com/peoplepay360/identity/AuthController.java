package com.peoplepay360.identity;

import com.peoplepay360.identity.IdentityDtos.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService service;
    public AuthController(AuthService service) { this.service = service; }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest in, HttpServletRequest req) {
        return service.login(in, clientIp(req));
    }

    @GetMapping("/me")
    public MeResponse me() { return service.me(); }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() { return ResponseEntity.noContent().build(); }

    private String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        return xff != null && !xff.isBlank() ? xff.split(",")[0].trim() : req.getRemoteAddr();
    }
}
