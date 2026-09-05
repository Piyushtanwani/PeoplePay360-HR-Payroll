package com.peoplepay360.controller;

import com.peoplepay360.dto.IdentityDtos.ForgotPasswordRequest;
import com.peoplepay360.dto.IdentityDtos.SetPasswordRequest;
import com.peoplepay360.service.UserInviteService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Public endpoints used by the emailed set-password link. No authentication by design. */
@RestController
@RequestMapping("/api/auth")
public class PasswordSetupController {
    private final UserInviteService invites;
    public PasswordSetupController(UserInviteService invites) { this.invites = invites; }

    @GetMapping("/set-password/check")
    public Map<String, Object> check(@RequestParam String token) {
        return Map.of("valid", invites.isTokenUsable(token));
    }

    @PostMapping("/set-password")
    public Map<String, Object> setPassword(@RequestBody SetPasswordRequest in) {
        invites.redeem(in.token(), in.password());
        return Map.of("status", "ok");
    }

    /** Always answers the same way regardless of whether the email matches an account. */
    @PostMapping("/forgot-password")
    public Map<String, Object> forgotPassword(@Valid @RequestBody ForgotPasswordRequest in, HttpServletRequest req) {
        invites.requestPasswordReset(in.email(), clientIp(req));
        return Map.of("status", "ok");
    }

    private String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        return xff != null && !xff.isBlank() ? xff.split(",")[0].trim() : req.getRemoteAddr();
    }
}
