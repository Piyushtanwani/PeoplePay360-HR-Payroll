package com.peoplepay360.payroll;

import com.peoplepay360.payroll.PayrollDtos.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payslips")
public class PayslipController {
    private final PayslipService service;
    private final PayslipPdfService pdfService;
    private final VarianceService varianceService;

    public PayslipController(PayslipService service, PayslipPdfService pdfService, VarianceService varianceService) {
        this.service = service;
        this.pdfService = pdfService;
        this.varianceService = varianceService;
    }

    @GetMapping
    public List<PayslipDto> list(@RequestParam(required = false) Long payrunId,
                                 @RequestParam(required = false) Long employeeId,
                                 @RequestParam(required = false) String period) {
        return service.list(payrunId, employeeId, period);
    }
    @GetMapping("/{id}")
    public PayslipDto get(@PathVariable Long id) { return service.get(id); }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable Long id) {
        PayslipDto p = service.get(id); // enforces ownership
        byte[] bytes = pdfService.render(id);
        String filename = "Payslip_" + p.employeeNo() + "_" + p.periodStart() + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(bytes);
    }

    @GetMapping("/{id}/variance")
    public VarianceService.Variance variance(@PathVariable Long id) { return varianceService.compare(id); }

    @PutMapping("/{id}/note")
    public void note(@PathVariable Long id, @RequestBody Map<String, String> body) {
        service.setNote(id, body.get("note"));
    }
}
