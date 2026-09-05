package com.peoplepay360.repository;

import com.peoplepay360.model.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.OffsetDateTime;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long>, JpaSpecificationExecutor<AuditEvent> {
    /** Admin dashboard tile and the audit summary chip. */
    long countByOutcomeAndOccurredAtAfter(String outcome, OffsetDateTime after);
}
