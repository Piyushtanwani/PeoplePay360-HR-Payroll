package com.peoplepay360.service;

import com.peoplepay360.common.Paging;
import com.peoplepay360.common.Specs;
import com.peoplepay360.model.AuditEvent;
import com.peoplepay360.repository.AuditEventRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Reading the audit trail.
 *
 * <p>The query lived in the controller, which meant the CSV export could not reuse it and exported the
 * entire table regardless of what the person was looking at. Both paths now build the same filter.
 */
@Service
public class AuditQueryService {
    private static final Map<String, String> SORTS = Map.of(
            "occurredAt", "occurredAt", "actorName", "actorName", "channel", "channel",
            "action", "action", "resourceType", "resourceType", "outcome", "outcome");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.desc("occurredAt"), Sort.Order.desc("id"));
    /** Ceiling on an export, so a single click cannot try to serialise years of history. */
    private static final int EXPORT_LIMIT = 5000;

    private final AuditEventRepository repo;

    public AuditQueryService(AuditEventRepository repo) {
        this.repo = repo;
    }

    /** Filters an audit query. Every parameter is optional; a null one simply does not narrow. */
    public record Filter(OffsetDateTime from, OffsetDateTime to, Long actorUserId, String channel,
                         String outcome, String resourceType, String q) {}

    @PreAuthorize("hasAuthority('audit.read')")
    @Transactional(readOnly = true)
    public Page<AuditEvent> list(Filter filter, Pageable pageable) {
        return repo.findAll(spec(filter), Paging.normalise(pageable, DEFAULT_SORT, SORTS));
    }

    /** Count of matching events, used for the summary chips above the table. */
    @PreAuthorize("hasAuthority('audit.read')")
    @Transactional(readOnly = true)
    public long count(Filter filter) {
        return repo.count(spec(filter));
    }

    @PreAuthorize("hasAuthority('audit.export')")
    @Transactional(readOnly = true)
    public String exportCsv(Filter filter) {
        List<AuditEvent> events = repo
                .findAll(spec(filter), PageRequest.of(0, EXPORT_LIMIT, DEFAULT_SORT))
                .getContent();
        StringBuilder sb = new StringBuilder(
                "id,occurredAt,actor,channel,action,resourceType,resourceId,outcome,reason,requestId\r\n");
        for (AuditEvent e : events) {
            sb.append(e.getId()).append(',')
                    .append(csv(String.valueOf(e.getOccurredAt()))).append(',')
                    .append(csv(e.getActorName())).append(',')
                    .append(csv(e.getChannel())).append(',')
                    .append(csv(e.getAction())).append(',')
                    .append(csv(e.getResourceType())).append(',')
                    .append(csv(e.getResourceId())).append(',')
                    .append(csv(e.getOutcome())).append(',')
                    .append(csv(e.getReason())).append(',')
                    .append(csv(e.getRequestId())).append("\r\n");
        }
        return sb.toString();
    }

    private Specification<AuditEvent> spec(Filter f) {
        return (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (f.from() != null) ps.add(cb.greaterThanOrEqualTo(root.get("occurredAt"), f.from()));
            if (f.to() != null) ps.add(cb.lessThanOrEqualTo(root.get("occurredAt"), f.to()));
            if (f.actorUserId() != null) ps.add(cb.equal(root.get("actorUserId"), f.actorUserId()));
            if (notBlank(f.channel())) ps.add(cb.equal(root.get("channel"), f.channel()));
            if (notBlank(f.outcome())) ps.add(cb.equal(root.get("outcome"), f.outcome()));
            if (notBlank(f.resourceType())) ps.add(cb.equal(root.get("resourceType"), f.resourceType()));
            if (notBlank(f.q())) {
                // Free text spans what a person would actually search for: the reason, the action and
                // who did it. Reason alone missed every event that was allowed and therefore unexplained.
                ps.add(cb.or(Specs.like(cb, root.get("reason"), f.q()),
                        Specs.like(cb, root.get("action"), f.q()),
                        Specs.like(cb, root.get("actorName"), f.q()),
                        Specs.like(cb, root.get("resourceType"), f.q())));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    /** RFC 4180 quoting, with a guard against a reason that a spreadsheet would treat as a formula. */
    private String csv(String value) {
        String v = value == null ? "" : value;
        if (!v.isEmpty() && "=+-@\t\r".indexOf(v.charAt(0)) >= 0) v = "'" + v;
        if (v.contains(",") || v.contains("\"") || v.contains("\n") || v.contains("\r")) {
            return '"' + v.replace("\"", "\"\"") + '"';
        }
        return v;
    }
}
