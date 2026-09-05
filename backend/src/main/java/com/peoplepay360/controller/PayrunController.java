package com.peoplepay360.controller;

import com.peoplepay360.common.PageResponse;
import com.peoplepay360.dto.PayrollDtos.*;
import com.peoplepay360.service.PayrunExportService;
import com.peoplepay360.service.PayrunService;
import com.peoplepay360.service.PayslipService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/payruns")
public class PayrunController {
    private final PayrunService service;
    private final PayslipService payslips;
    private final PayrunExportService exportService;

    public PayrunController(PayrunService service, PayslipService payslips, PayrunExportService exportService) {
        this.service = service;
        this.payslips = payslips;
        this.exportService = exportService;
    }

    @GetMapping
    public PageResponse<PayrunDto> list(@RequestParam(required = false) String state,
                                        @RequestParam(required = false) String period,
                                        @RequestParam(required = false) String q,
                                        Pageable pageable) {
        return PageResponse.of(service.list(state, period, q, pageable));
    }

    @GetMapping("/{id}")
    public PayrunDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @GetMapping("/{id}/delivery")
    public DeliveryReport delivery(@PathVariable Long id) {
        return payslips.deliveryReport(id);
    }

    /** The bank file for a payrun. Account numbers are masked; the full number never leaves the database. */
    @GetMapping(value = "/{id}/export.csv", produces = "text/csv")
    public ResponseEntity<byte[]> exportCsv(@PathVariable Long id) {
        PayrunExportService.Export export = exportService.toCsv(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + export.filename() + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=utf-8"))
                .body(export.csv().getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping("/eligibility")
    public List<EligibleEmployee> eligibility(@Valid @RequestBody EligibilityRequest in) {
        return service.eligibility(in);
    }

    @PostMapping
    public PayrunDto create(@Valid @RequestBody CreatePayrun in) {
        return service.create(in);
    }

    @PutMapping("/{id}")
    public PayrunDto update(@PathVariable Long id, @RequestBody UpdatePayrun in) {
        return service.update(id, in);
    }

    @PostMapping("/{id}/compute")
    public PayrunDto compute(@PathVariable Long id) {
        return service.compute(id);
    }

    @GetMapping("/{id}/issues")
    public List<PayrunIssueDto> issues(@PathVariable Long id,
                                       @RequestParam(required = false) String severity,
                                       @RequestParam(required = false) String status) {
        return service.issues(id, severity, status);
    }

    @PostMapping("/{id}/issues/{issueId}/override")
    public void override(@PathVariable Long id, @PathVariable Long issueId, @RequestBody OverrideRequest in) {
        service.overrideIssue(id, issueId, in);
    }

    @PostMapping("/{id}/validate")
    public PayrunDto validate(@PathVariable Long id) {
        return service.validate(id);
    }

    @PostMapping("/{id}/pay")
    public PayrunDto pay(@PathVariable Long id, @RequestBody(required = false) PayRequest in) {
        return service.pay(id, in);
    }

    @PostMapping("/{id}/send")
    public ResponseEntity<SendResult> send(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(service.send(id));
    }

    @PostMapping("/{id}/cancel")
    public void cancel(@PathVariable Long id) {
        service.cancel(id);
    }

    @PostMapping("/{id}/inputs")
    public void addInput(@PathVariable Long id, @Valid @RequestBody PayInput in) {
        service.addInput(id, in);
    }
}
