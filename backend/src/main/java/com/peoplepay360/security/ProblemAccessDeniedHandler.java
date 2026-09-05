package com.peoplepay360.security;

import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import java.io.IOException;

@Component
public class ProblemAccessDeniedHandler implements AccessDeniedHandler {
    private final AuditService audit;
    public ProblemAccessDeniedHandler(AuditService audit) { this.audit = audit; }

    @Override
    public void handle(HttpServletRequest req, HttpServletResponse res, AccessDeniedException ex)
            throws IOException {
        audit.deny(Channel.UI, req.getMethod() + " " + req.getRequestURI(), null, null, "access denied");
        ProblemWriter.write(res, ErrorCode.PERMISSION_DENIED, "You do not have permission to perform this action.");
    }
}
