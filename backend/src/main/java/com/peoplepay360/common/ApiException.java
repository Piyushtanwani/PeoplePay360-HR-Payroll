package com.peoplepay360.common;

public class ApiException extends RuntimeException {
    private final ErrorCode code;
    private final String requiredPermission;

    public ApiException(ErrorCode code, String message) {
        this(code, message, null);
    }
    public ApiException(ErrorCode code, String message, String requiredPermission) {
        super(message);
        this.code = code;
        this.requiredPermission = requiredPermission;
    }
    public ErrorCode getCode() { return code; }
    public String getRequiredPermission() { return requiredPermission; }

    public static ApiException notFound(String what) {
        return new ApiException(ErrorCode.NOT_FOUND, what + " not found");
    }
    public static ApiException validation(String msg) {
        return new ApiException(ErrorCode.VALIDATION_ERROR, msg);
    }
    public static ApiException illegalState(String msg) {
        return new ApiException(ErrorCode.ILLEGAL_STATE, msg);
    }
    public static ApiException conflict(String msg) {
        return new ApiException(ErrorCode.DUPLICATE, msg);
    }
}
