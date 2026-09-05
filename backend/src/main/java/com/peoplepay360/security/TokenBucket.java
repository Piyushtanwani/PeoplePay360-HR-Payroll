package com.peoplepay360.security;

/** Minimal thread-safe token bucket: capacity tokens, refilled fully every windowMillis. */
public final class TokenBucket {
    private final int capacity;
    private final long windowMillis;
    private double tokens;
    private long lastRefill;

    public TokenBucket(int capacity, long windowMillis) {
        this.capacity = capacity;
        this.windowMillis = windowMillis;
        this.tokens = capacity;
        this.lastRefill = System.currentTimeMillis();
    }

    public synchronized boolean tryConsume() {
        long now = System.currentTimeMillis();
        double refill = (double) (now - lastRefill) / windowMillis * capacity;
        if (refill > 0) {
            tokens = Math.min(capacity, tokens + refill);
            lastRefill = now;
        }
        if (tokens >= 1) {
            tokens -= 1;
            return true;
        }
        return false;
    }
}
