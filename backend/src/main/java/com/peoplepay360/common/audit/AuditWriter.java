package com.peoplepay360.common.audit;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import com.peoplepay360.model.AuditEvent;
import com.peoplepay360.repository.AuditEventRepository;

/**
 * Persists an audit event in its own writable transaction. Kept in a separate bean so the REQUIRES_NEW boundary
 * is applied through the Spring proxy even when the caller runs inside a read-only transaction.
 */
@Component
public class AuditWriter {
    private final AuditEventRepository repo;
    public AuditWriter(AuditEventRepository repo) { this.repo = repo; }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = false)
    public void write(AuditEvent e) {
        repo.save(e);
    }
}
