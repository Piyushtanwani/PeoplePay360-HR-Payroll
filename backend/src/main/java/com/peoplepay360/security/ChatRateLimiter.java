package com.peoplepay360.security;

import com.peoplepay360.config.AppProperties;
import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ChatRateLimiter {
    private static final long WINDOW = 10 * 60 * 1000L;
    private final int limit;
    private final ConcurrentHashMap<Long, TokenBucket> buckets = new ConcurrentHashMap<>();
    public ChatRateLimiter(AppProperties props) { this.limit = props.getChat().getRateLimitPer10Min(); }

    public boolean tryConsume(Long userId) {
        return buckets.computeIfAbsent(userId, k -> new TokenBucket(limit, WINDOW)).tryConsume();
    }
}
