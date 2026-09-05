package com.peoplepay360.common;

import com.peoplepay360.security.CurrentUser;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestControllerAdvice
public class ProblemDetailsAdvice {
    private static final Logger log = LoggerFactory.getLogger(ProblemDetailsAdvice.class);
    private final CurrentUser currentUser;
    public ProblemDetailsAdvice(CurrentUser currentUser) { this.currentUser = currentUser; }

    @ExceptionHandler(ApiException.class)
    public ProblemDetail handleApi(ApiException ex, HttpServletResponse res) {
        ProblemDetail pd = base(ex.getCode(), ex.getMessage());
        if (ex.getRequiredPermission() != null && safeCanSee()) {
            pd.setProperty("requiredPermission", ex.getRequiredPermission());
        }
        addRetryAfter(ex.getCode(), res);
        return pd;
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleDenied(AccessDeniedException ex) {
        return base(ErrorCode.PERMISSION_DENIED, "You do not have permission to perform this action.");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        ProblemDetail pd = base(ErrorCode.VALIDATION_ERROR, "Validation failed.");
        List<Map<String, String>> errors = new ArrayList<>();
        ex.getBindingResult().getFieldErrors().forEach(fe ->
                errors.add(Map.of("field", fe.getField(), "message",
                        fe.getDefaultMessage() == null ? "invalid" : fe.getDefaultMessage())));
        pd.setProperty("errors", errors);
        return pd;
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleIntegrity(DataIntegrityViolationException ex) {
        String msg = ex.getMostSpecificCause().getMessage();
        if (msg != null && msg.contains("contract_no_overlap")) {
            return base(ErrorCode.CONTRACT_OVERLAP, "This contract overlaps an existing contract for the employee.");
        }
        if (msg != null && (msg.contains("uq_payslip_period") || msg.contains("duplicate key"))) {
            return base(ErrorCode.DUPLICATE, "A conflicting record already exists.");
        }
        return base(ErrorCode.ILLEGAL_STATE, "The operation conflicts with the current data state.");
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneric(Exception ex) {
        log.error("Unhandled exception [requestId={}]", RequestContext.getRequestId(), ex);
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        pd.setTitle("Internal Server Error");
        pd.setDetail("An unexpected error occurred.");
        pd.setProperty("code", "INTERNAL_ERROR");
        pd.setProperty("requestId", RequestContext.getRequestId());
        return pd;
    }

    private ProblemDetail base(ErrorCode code, String detail) {
        ProblemDetail pd = ProblemDetail.forStatus(code.status);
        pd.setTitle(code.status.getReasonPhrase());
        pd.setDetail(detail);
        pd.setProperty("code", code.name());
        pd.setProperty("requestId", RequestContext.getRequestId());
        return pd;
    }
    private boolean safeCanSee() {
        try { return currentUser.canSeeRequiredPermission(); } catch (Exception e) { return false; }
    }
    private void addRetryAfter(ErrorCode code, HttpServletResponse res) {
        if (code == ErrorCode.RATE_LIMITED) res.setHeader("Retry-After", "600");
    }
}
