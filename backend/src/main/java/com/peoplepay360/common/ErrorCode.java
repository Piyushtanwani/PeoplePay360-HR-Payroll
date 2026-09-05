package com.peoplepay360.common;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED),
    PERMISSION_DENIED(HttpStatus.FORBIDDEN),
    SELF_ACTION(HttpStatus.FORBIDDEN),
    TOKEN_STALE(HttpStatus.UNAUTHORIZED),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    CONTRACT_OVERLAP(HttpStatus.CONFLICT),
    DUPLICATE(HttpStatus.CONFLICT),
    ILLEGAL_STATE(HttpStatus.CONFLICT),
    NOT_OVERRIDABLE(HttpStatus.CONFLICT),
    BLOCKERS_PRESENT(HttpStatus.CONFLICT),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS),
    AI_PROVIDER_ERROR(HttpStatus.BAD_GATEWAY),
    MCP_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE);

    public final HttpStatus status;
    ErrorCode(HttpStatus status) { this.status = status; }
}
