package com.peoplepay360.payroll;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.peoplepay360.common.ApiException;
import com.peoplepay360.employee.Employee;
import com.peoplepay360.employee.EmployeeRepository;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.util.HexFormat;

/** Renders a payslip to PDF from the persisted lines using Thymeleaf and OpenHTMLtoPDF. */
@Service
public class PayslipPdfService {
    private final TemplateEngine templateEngine;
    private final EmployeeRepository employees;
    private final PayslipRepository payslips;
    private final PayslipLineRepository payslipLines;

    public PayslipPdfService(TemplateEngine templateEngine, EmployeeRepository employees, PayslipRepository payslips, PayslipLineRepository payslipLines) {
        this.payslipLines = payslipLines;
        this.templateEngine = templateEngine;
        this.employees = employees;
        this.payslips = payslips;
    }

    public byte[] render(Long payslipId) {
        Payslip p = payslips.findById(payslipId).orElseThrow(() -> ApiException.notFound("payslip"));
        Employee e = employees.findById(p.getEmployeeId()).orElseThrow(() -> ApiException.notFound("employee"));
        p.setLines(payslipLines.findByPayslipIdOrderBySequenceAsc(p.getId()));
        String html = renderHtml(p, e);
        try {
            ByteArrayOutputStream os = new ByteArrayOutputStream();
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(os);
            builder.run();
            return os.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to render payslip PDF", ex);
        }
    }

    public String renderHtml(Payslip p, Employee e) {
        Context ctx = new Context();
        ctx.setVariable("employeeName", e.getDisplayName());
        ctx.setVariable("employeeNo", e.getEmployeeNo());
        ctx.setVariable("period", p.getPeriodStart() + " to " + p.getPeriodEnd());
        ctx.setVariable("workedDays", p.getWorkedDays());
        ctx.setVariable("scheduledDays", p.getScheduledDays());
        ctx.setVariable("unpaidDays", p.getUnpaidDays());
        ctx.setVariable("lines", p.getLines());
        ctx.setVariable("gross", p.getGross());
        ctx.setVariable("deductions", p.getDeductions());
        ctx.setVariable("net", p.getNet());
        ctx.setVariable("payslipId", p.getId());
        ctx.setVariable("hash", sha256(p));
        return templateEngine.process("payslip", ctx);
    }

    public String sha256(Payslip p) {
        try {
            String content = p.getId() + "|" + p.getEmployeeId() + "|" + p.getNet() + "|" + p.getPeriodEnd();
            byte[] d = MessageDigest.getInstance("SHA-256").digest(content.getBytes());
            return HexFormat.of().formatHex(d);
        } catch (Exception ex) {
            return "";
        }
    }
}
