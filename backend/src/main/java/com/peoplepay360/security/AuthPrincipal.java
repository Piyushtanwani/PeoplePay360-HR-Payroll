package com.peoplepay360.security;

public record AuthPrincipal(
        Long userId,
        Long employeeId,
        String roleCode,
        boolean chat,
        Integer permVersion,
        String name
) {}
