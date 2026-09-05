package com.peoplepay360.controller;

import com.peoplepay360.common.PageResponse;
import com.peoplepay360.model.AuditEvent;
import com.peoplepay360.service.AuditQueryService;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;

/**
 * The audit trail: who did what, through which channel, and whether it was allowed.
 * Permissions live on the service, alongside the query.
 */
@RestController
@RequestMapping("/api/admin/audit")
public class AuditController {
    private final AuditQueryService service;

    public AuditController(AuditQueryService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<AuditEvent> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(required = false) Long actorUserId,
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String outcome,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String q,
            Pageable pageable) {
        return PageResponse.of(service.list(filter(from, to, actorUserId, channel, outcome, resourceType, q), pageable));
    }

    /** Count of denials in the same range, for the summary chip above the table. */
    @GetMapping("/summary")
    public AuditSummary summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(required = false) Long actorUserId,
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String q) {
        long total = service.count(filter(from, to, actorUserId, channel, null, resourceType, q));
        long denied = service.count(filter(from, to, actorUserId, channel, "DENY", resourceType, q));
        return new AuditSummary(total, denied);
    }

    public record AuditSummary(long events, long denied) {}

    /** Exports what the caller is currently looking at, not the whole table. */
    @GetMapping(value = "/export.csv", produces = "text/csv")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(required = false) Long actorUserId,
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String outcome,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String q) {
        String csv = service.exportCsv(filter(from, to, actorUserId, channel, outcome, resourceType, q));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"audit.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=utf-8"))
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }

    private AuditQueryService.Filter filter(OffsetDateTime from, OffsetDateTime to, Long actorUserId,
                                            String channel, String outcome, String resourceType, String q) {
        return new AuditQueryService.Filter(from, to, actorUserId, channel, outcome, resourceType, q);
    }
}
