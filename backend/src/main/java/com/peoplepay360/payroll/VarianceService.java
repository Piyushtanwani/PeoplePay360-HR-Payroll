package com.peoplepay360.payroll;

import com.peoplepay360.common.ApiException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class VarianceService {
    private final PayslipRepository payslips;
    private final PayslipLineRepository payslipLines;
    public VarianceService(PayslipRepository payslips, PayslipLineRepository payslipLines) { this.payslips = payslips; this.payslipLines = payslipLines; }

    public record LineDelta(String ruleCode, BigDecimal previous, BigDecimal current, BigDecimal delta) {}
    public record Variance(Long previousPayslipId, BigDecimal netDelta, BigDecimal netDeltaPct, List<LineDelta> lineDeltas) {}

    @PreAuthorize("hasAuthority('payslip.read.all')")
    @Transactional(readOnly = true)
    public Variance compare(Long payslipId) {
        Payslip current = payslips.findById(payslipId).orElseThrow(() -> ApiException.notFound("payslip"));
        Payslip previous = payslips.findByEmployeeId(current.getEmployeeId()).stream()
                .filter(p -> p.getPeriodEnd().isBefore(current.getPeriodStart()))
                .max(Comparator.comparing(Payslip::getPeriodEnd))
                .orElse(null);
        if (previous == null) {
            return new Variance(null, BigDecimal.ZERO, BigDecimal.ZERO, List.of());
        }
        BigDecimal netDelta = current.getNet().subtract(previous.getNet());
        BigDecimal pct = previous.getNet().signum() == 0 ? BigDecimal.ZERO :
                netDelta.multiply(BigDecimal.valueOf(100)).divide(previous.getNet(), 2, RoundingMode.HALF_UP);
        List<LineDelta> deltas = new ArrayList<>();
        for (PayslipLine cl : payslipLines.findByPayslipIdOrderBySequenceAsc(current.getId())) {
            BigDecimal prev = payslipLines.findByPayslipIdOrderBySequenceAsc(previous.getId()).stream()
                    .filter(pl -> pl.getRuleCode().equals(cl.getRuleCode()))
                    .map(PayslipLine::getAmount).findFirst().orElse(BigDecimal.ZERO);
            deltas.add(new LineDelta(cl.getRuleCode(), prev, cl.getAmount(), cl.getAmount().subtract(prev)));
        }
        return new Variance(previous.getId(), netDelta, pct, deltas);
    }

    /** True when |net change| exceeds 25 percent versus the previous payslip. */
    public boolean isFlagged(Long payslipId) {
        Variance v = compare(payslipId);
        return v.netDeltaPct().abs().compareTo(BigDecimal.valueOf(25)) > 0;
    }
}
