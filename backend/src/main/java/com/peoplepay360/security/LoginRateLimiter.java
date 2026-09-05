package com.peoplepay360.security;

import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentHashMap;

/** 10 attempts per email or per IP in 15 minutes. */
@Component
public class LoginRateLimiter {
    private static final int LIMIT = 10;
    private static final long WINDOW = 15 * 60 * 1000L;
    private final ConcurrentHashMap<String, TokenBucket> buckets = new ConcurrentHashMap<>();

    private TokenBucket bucket(String key) {
        return buckets.computeIfAbsent(key, k -> new TokenBucket(LIMIT, WINDOW));
    }
    public boolean tryConsume(String email, String ip) {
        boolean e = bucket("email:" + email).tryConsume();
        boolean i = bucket("ip:" + ip).tryConsume();
        return e && i;
    }
}
