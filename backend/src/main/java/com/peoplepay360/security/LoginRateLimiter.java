package com.peoplepay360.security;

import com.peoplepay360.config.AppProperties;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Throttles sign-in attempts per email and per IP over a rolling 15 minute window.
 * The limit is configurable (app.security.login-attempts) so integration runs, which
 * sign in as every role in sequence, are not throttled by the production default of 10.
 */
@Component
public class LoginRateLimiter {
    private static final long WINDOW_MILLIS = 15 * 60 * 1000L;
    private final ConcurrentHashMap<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    private final int limit;

    public LoginRateLimiter(AppProperties props) {
        this.limit = props.getSecurity().getLoginAttempts();
    }

    private TokenBucket bucket(String key) {
        return buckets.computeIfAbsent(key, k -> new TokenBucket(limit, WINDOW_MILLIS));
    }

    /** Consumes one token from both the email and the IP bucket; false means the caller is throttled. */
    public boolean tryConsume(String email, String ip) {
        boolean emailOk = bucket("email:" + email).tryConsume();
        boolean ipOk = bucket("ip:" + ip).tryConsume();
        return emailOk && ipOk;
    }
}
