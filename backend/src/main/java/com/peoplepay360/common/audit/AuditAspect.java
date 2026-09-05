package com.peoplepay360.common.audit;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class AuditAspect {
    private final AuditService audit;
    public AuditAspect(AuditService audit) { this.audit = audit; }

    @Around("@annotation(com.peoplepay360.common.audit.Audited)")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        MethodSignature sig = (MethodSignature) pjp.getSignature();
        Audited ann = sig.getMethod().getAnnotation(Audited.class);
        Object result = pjp.proceed();
        String resourceId = extractId(result);
        audit.record(Channel.UI, ann.action(), ann.resourceType(), resourceId, "ALLOW",
                null, null, audit.toJson(result));
        return result;
    }

    private String extractId(Object result) {
        if (result == null) return null;
        try {
            var m = result.getClass().getMethod("id");
            Object v = m.invoke(result);
            return v == null ? null : v.toString();
        } catch (Exception ignored) { }
        try {
            var m = result.getClass().getMethod("getId");
            Object v = m.invoke(result);
            return v == null ? null : v.toString();
        } catch (Exception ignored) { }
        return null;
    }
}
