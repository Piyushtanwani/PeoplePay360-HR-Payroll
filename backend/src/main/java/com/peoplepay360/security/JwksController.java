package com.peoplepay360.security;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class JwksController {
    private final JwtService jwtService;
    public JwksController(JwtService jwtService) { this.jwtService = jwtService; }

    @GetMapping(value = "/.well-known/jwks.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public String jwks() { return jwtService.jwksJson(); }
}
