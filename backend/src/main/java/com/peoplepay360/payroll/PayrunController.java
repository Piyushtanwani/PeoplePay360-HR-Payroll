package com.peoplepay360.payroll;

import com.peoplepay360.payroll.PayrollDtos.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/payruns")
public class PayrunController {
    private final PayrunService service;
    public PayrunController(PayrunService service) { this.service = service; }

    @GetMapping
    public List<PayrunDto> list(@RequestParam(required = false) String state,
                                @RequestParam(required = false) String period) {
        return service.list(state, period);
    }
    @PostMapping("/eligibility")
    public List<EligibleEmployee> eligibility(@Valid @RequestBody EligibilityRequest in) {
        return service.eligibility(in);
    }
    @PostMapping
    public PayrunDto create(@Valid @RequestBody CreatePayrun in) { return service.create(in); }
    @GetMapping("/{id}")
    public PayrunDto get(@PathVariable Long id) { return service.get(id); }
    @PutMapping("/{id}")
    public PayrunDto update(@PathVariable Long id, @RequestBody UpdatePayrun in) { return service.update(id, in); }
    @PostMapping("/{id}/compute")
    public PayrunDto compute(@PathVariable Long id) { return service.compute(id); }
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
    public PayrunDto validate(@PathVariable Long id) { return service.validate(id); }
    @PostMapping("/{id}/pay")
    public PayrunDto pay(@PathVariable Long id, @RequestBody(required = false) PayRequest in) { return service.pay(id, in); }
    @PostMapping("/{id}/send")
    public ResponseEntity<SendResult> send(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(service.send(id));
    }
    @PostMapping("/{id}/cancel")
    public void cancel(@PathVariable Long id) { service.cancel(id); }
    @PostMapping("/{id}/inputs")
    public void addInput(@PathVariable Long id, @Valid @RequestBody PayInput in) { service.addInput(id, in); }
}
