package com.peoplepay360.controller;

import com.peoplepay360.common.PageResponse;
import com.peoplepay360.model.AuditEvent;
import com.peoplepay360.repository.AuditEventRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/admin/audit")
public class AuditController {
    private final AuditEventRepository repo;
    public AuditController(AuditEventRepository repo) { this.repo = repo; }

    @GetMapping
    @PreAuthorize("hasAuthority('audit.read')")
    public PageResponse<AuditEvent> list(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
                                         @RequestParam(required = false) Long actorUserId,
                                         @RequestParam(required = false) String channel,
                                         @RequestParam(required = false) String outcome,
                                         @RequestParam(required = false) String resourceType,
                                         @RequestParam(required = false) String q,
                                         Pageable pageable) {
        Specification<AuditEvent> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (from != null) ps.add(cb.greaterThanOrEqualTo(root.get("occurredAt"), from));
            if (to != null) ps.add(cb.lessThanOrEqualTo(root.get("occurredAt"), to));
            if (actorUserId != null) ps.add(cb.equal(root.get("actorUserId"), actorUserId));
            if (channel != null) ps.add(cb.equal(root.get("channel"), channel));
            if (outcome != null) ps.add(cb.equal(root.get("outcome"), outcome));
            if (resourceType != null) ps.add(cb.equal(root.get("resourceType"), resourceType));
            if (q != null && !q.isBlank()) ps.add(cb.like(cb.lower(root.get("reason")), "%" + q.toLowerCase() + "%"));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return PageResponse.of(repo.findAll(spec, pageable));
    }

    @GetMapping(value = "/export.csv", produces = "text/csv")
    @PreAuthorize("hasAuthority('audit.export')")
    public String export() {
        StringBuilder sb = new StringBuilder("id,occurredAt,actor,channel,action,resourceType,resourceId,outcome,reason\n");
        for (AuditEvent e : repo.findAll()) {
            sb.append(e.getId()).append(',').append(e.getOccurredAt()).append(',')
              .append(e.getActorName() == null ? "" : e.getActorName()).append(',')
              .append(e.getChannel()).append(',').append(e.getAction()).append(',')
              .append(e.getResourceType() == null ? "" : e.getResourceType()).append(',')
              .append(e.getResourceId() == null ? "" : e.getResourceId()).append(',')
              .append(e.getOutcome()).append(',')
              .append(e.getReason() == null ? "" : e.getReason().replace(",", ";")).append('\n');
        }
        return sb.toString();
    }
}
