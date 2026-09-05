package com.peoplepay360.common;

public class PermissionDeniedException extends ApiException {
    public PermissionDeniedException(String requiredPermission) {
        super(ErrorCode.PERMISSION_DENIED, "You do not have permission to perform this action.", requiredPermission);
    }
}
