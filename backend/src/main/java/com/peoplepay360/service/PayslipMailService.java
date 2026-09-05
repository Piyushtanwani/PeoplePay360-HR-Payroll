package com.peoplepay360.service;

import com.peoplepay360.config.AppProperties;
import com.peoplepay360.model.Employee;
import com.peoplepay360.repository.EmployeeRepository;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.core.io.ByteArrayResource;
import java.time.OffsetDateTime;
import java.util.List;
import com.peoplepay360.model.Payslip;
import com.peoplepay360.model.PayslipDelivery;
import com.peoplepay360.repository.PayrunRepository;
import com.peoplepay360.repository.PayslipDeliveryRepository;
import com.peoplepay360.repository.PayslipRepository;

/** Sends payslip PDFs asynchronously and records delivery status per payslip. */
@Service
public class PayslipMailService {
    private static final Logger log = LoggerFactory.getLogger(PayslipMailService.class);
    private final JavaMailSender mailSender;
    private final PayslipRepository payslips;
    private final PayslipDeliveryRepository deliveries;
    private final PayslipPdfService pdfService;
    private final EmployeeRepository employees;
    private final PayrunRepository payruns;
    private final AppProperties props;

    public PayslipMailService(JavaMailSender mailSender, PayslipRepository payslips,
                              PayslipDeliveryRepository deliveries, PayslipPdfService pdfService,
                              EmployeeRepository employees, PayrunRepository payruns, AppProperties props) {
        this.mailSender = mailSender;
        this.payslips = payslips;
        this.deliveries = deliveries;
        this.pdfService = pdfService;
        this.employees = employees;
        this.payruns = payruns;
        this.props = props;
    }

    @Async("mailExecutor")
    @Transactional
    public void sendAll(Long payrunId) {
        List<Payslip> slips = payslips.findByPayrunId(payrunId);
        for (Payslip p : slips) {
            PayslipDelivery d = deliveries.findByPayslipId(p.getId()).orElseGet(() -> {
                PayslipDelivery nd = new PayslipDelivery();
                nd.setPayslipId(p.getId());
                return nd;
            });
            Employee e = employees.findById(p.getEmployeeId()).orElse(null);
            String recipient = e == null ? null : e.getWorkEmail();
            d.setRecipient(recipient);
            if (recipient == null || recipient.isBlank()) {
                d.setStatus("SKIPPED_NO_RECIPIENT");
                deliveries.save(d);
                continue;
            }
            d.setStatus("QUEUED");
            deliveries.save(d);
            boolean sent = false;
            for (int attempt = 1; attempt <= 3 && !sent; attempt++) {
                try {
                    byte[] pdf = pdfService.render(p.getId());
                    MimeMessage msg = mailSender.createMimeMessage();
                    MimeMessageHelper helper = new MimeMessageHelper(msg, true);
                    helper.setFrom(props.getMailFrom());
                    helper.setTo(recipient);
                    helper.setSubject("Your payslip for " + p.getPeriodStart() + " to " + p.getPeriodEnd());
                    helper.setText("Please find your payslip attached.", false);
                    helper.addAttachment("Payslip_" + p.getId() + ".pdf", new ByteArrayResource(pdf));
                    mailSender.send(msg);
                    d.setStatus("SENT");
                    d.setSentAt(OffsetDateTime.now());
                    d.setPdfSha256(pdfService.sha256(p));
                    d.setAttempts(attempt);
                    sent = true;
                } catch (Exception ex) {
                    d.setLastError(ex.getMessage());
                    d.setAttempts(attempt);
                    log.warn("Payslip {} delivery attempt {} failed: {}", p.getId(), attempt, ex.getMessage());
                }
            }
            if (!sent) d.setStatus("FAILED");
            deliveries.save(d);
        }
        payruns.findById(payrunId).ifPresent(pr -> {
            pr.setState("SENT");
            pr.setSentAt(OffsetDateTime.now());
        });
        log.info("Payslip delivery job for payrun {} finished.", payrunId);
    }
}
