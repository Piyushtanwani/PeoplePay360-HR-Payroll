package com.peoplepay360.security;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.SignedJWT;
import com.peoplepay360.config.AppProperties;
import com.peoplepay360.model.AppUser;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.file.*;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * Mints browser (aud=web) and delegated chat (aud=mcp, act=chat) tokens, and exposes the public JWKS.
 * On startup it loads an RSA key from the configured PEM or key file, or generates and persists one for development.
 */
@Service
public class JwtService {
    private static final Logger log = LoggerFactory.getLogger(JwtService.class);
    private final AppProperties props;
    private RSAKey rsaKey;
    private RSASSASigner signer;

    public JwtService(AppProperties props) { this.props = props; }

    @PostConstruct
    void init() throws Exception {
        String kid = "peoplepay-key-1";
        Path keyPath = Path.of(props.getJwt().getKeyPath());
        String json = null;
        if (Files.exists(keyPath)) {
            json = Files.readString(keyPath);
        }
        if (json != null && !json.isBlank()) {
            this.rsaKey = RSAKey.parse(json);
        } else {
            this.rsaKey = new RSAKeyGenerator(2048).keyID(kid).generate();
            try {
                if (keyPath.getParent() != null) Files.createDirectories(keyPath.getParent());
                Files.writeString(keyPath, this.rsaKey.toJSONString());
                log.warn("Generated a development RSA signing key at {}. Do not use this in production.", keyPath);
            } catch (Exception e) {
                log.warn("Could not persist the generated signing key: {}", e.getMessage());
            }
        }
        this.signer = new RSASSASigner(this.rsaKey);
    }

    /** Public JWKS JSON for the resource server and the MCP service. */
    public String jwksJson() {
        return "{\"keys\":[" + rsaKey.toPublicJWK().toJSONString() + "]}";
    }

    public RSAKey publicKey() { return rsaKey.toPublicJWK(); }

    public String mintBrowserToken(AppUser user) {
        try {
            Instant now = Instant.now();
            JWTClaimsBuilder b = new JWTClaimsBuilder()
                    .issuer(props.getJwt().getIssuer())
                    .subject(String.valueOf(user.getId()))
                    .audience("web")
                    .claim("roles", List.of(user.getRole().getCode()))
                    .claim("emp", user.getEmployeeId())
                    .claim("name", user.getDisplayName())
                    .issueTime(Date.from(now))
                    .expirationTime(Date.from(now.plusSeconds(props.getJwt().getAccessTtlSeconds())));
            return sign(b.build());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to mint token", e);
        }
    }

    public String mintDelegatedToken(AppUser user, Long sessionId, List<String> perms) {
        try {
            Instant now = Instant.now();
            JWTClaimsBuilder b = new JWTClaimsBuilder()
                    .issuer(props.getJwt().getIssuer())
                    .subject(String.valueOf(user.getId()))
                    .audience("mcp")
                    .claim("act", "chat")
                    .claim("scp", List.of("read"))
                    .claim("emp", user.getEmployeeId())
                    .claim("permVersion", user.getPermVersion())
                    .claim("perms", perms)
                    .claim("sessionId", sessionId)
                    .issueTime(Date.from(now))
                    .expirationTime(Date.from(now.plusSeconds(props.getJwt().getDelegatedTtlSeconds())));
            return sign(b.build());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to mint delegated token", e);
        }
    }

    private String sign(com.nimbusds.jwt.JWTClaimsSet claims) throws JOSEException {
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(rsaKey.getKeyID()).build(),
                claims);
        jwt.sign(signer);
        return jwt.serialize();
    }

    /** Thin builder wrapper to keep the mint methods readable. */
    private static final class JWTClaimsBuilder {
        private final com.nimbusds.jwt.JWTClaimsSet.Builder b = new com.nimbusds.jwt.JWTClaimsSet.Builder();
        JWTClaimsBuilder issuer(String v) { b.issuer(v); return this; }
        JWTClaimsBuilder subject(String v) { b.subject(v); return this; }
        JWTClaimsBuilder audience(String v) { b.audience(v); return this; }
        JWTClaimsBuilder claim(String k, Object v) { b.claim(k, v); return this; }
        JWTClaimsBuilder issueTime(Date v) { b.issueTime(v); return this; }
        JWTClaimsBuilder expirationTime(Date v) { b.expirationTime(v); return this; }
        com.nimbusds.jwt.JWTClaimsSet build() { b.jwtID(UUID.randomUUID().toString()); return b.build(); }
    }
}
