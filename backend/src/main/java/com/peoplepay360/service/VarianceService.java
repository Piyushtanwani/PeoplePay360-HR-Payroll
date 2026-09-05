package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.Money;
import com.peoplepay360.config.AppProperties;
import com.peoplepay360.model.Payslip;
import com.peoplepay360.model.PayslipLine;
import com.peoplepay360.repository.PayslipLineRepository;
import com.peoplepay360.repository.PayslipRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Compares a payslip against the same employee's previous one.
 *
 * <p>Two entry points on purpose. {@link #compare} is what the payslip screen calls and is permission
 * checked. {@link #variance} is the same computation without the check, for the payrun checker, which
 * runs as part of a compute and must not require the caller to hold payslip read rights of their own.
 */
@Service
public class VarianceService {
    private final PayslipRepository payslips;
    private final PayslipLineRepository payslipLines;
    private final AppProperties props;

    public VarianceService(PayslipRepository payslips, PayslipLineRepository payslipLines, AppProperties props) {
        this.payslips = payslips;
        this.payslipLines = payslipLines;
        this.props = props;
    }

    public record LineDelta(String ruleCode, BigDecimal previous, BigDecimal current, BigDecimal delta) {}
    public record Variance(Long previousPayslipId, BigDecimal netDelta, BigDecimal netDeltaPct,
                           List<LineDelta> lineDeltas) {}

    @PreAuthorize("hasAuthority('payslip.read.all')")
    @Transactional(readOnly = true)
    public Variance compare(Long payslipId) {
        Payslip current = payslips.findById(payslipId).orElseThrow(() -> ApiException.notFound("payslip"));
        return variance(current);
    }

    /** The comparison itself. Returns an empty variance when there is no earlier payslip to compare against. */
    @Transactional(readOnly = true)
    public Variance variance(Payslip current) {
        Payslip previous = payslips.findByEmployeeId(current.getEmployeeId()).stream()
                .filter(p -> p.getPeriodEnd().isBefore(current.getPeriodStart()))
                .max(Comparator.comparing(Payslip::getPeriodEnd))
                .orElse(null);
        if (previous == null) return new Variance(null, Money.zero(), BigDecimal.ZERO, List.of());

        BigDecimal netDelta = Money.scale(current.getNet().subtract(previous.getNet()));
        BigDecimal pct = previous.getNet().signum() == 0
                ? BigDecimal.ZERO
                : netDelta.multiply(BigDecimal.valueOf(100)).divide(previous.getNet(), 2, RoundingMode.HALF_UP);

        // Previous lines are read once and indexed, rather than re-read for every current line.
        Map<String, BigDecimal> previousByCode = new HashMap<>();
        for (PayslipLine pl : payslipLines.findByPayslipIdOrderBySequenceAsc(previous.getId())) {
            previousByCode.put(pl.getRuleCode(), pl.getAmount());
        }
        List<LineDelta> deltas = new ArrayList<>();
        for (PayslipLine line : payslipLines.findByPayslipIdOrderBySequenceAsc(current.getId())) {
            BigDecimal before = previousByCode.getOrDefault(line.getRuleCode(), Money.zero());
            deltas.add(new LineDelta(line.getRuleCode(), before, line.getAmount(),
                    Money.scale(line.getAmount().subtract(before))));
        }
        return new Variance(previous.getId(), netDelta, pct, deltas);
    }

    /**
     * True when net pay moved further than the configured threshold against the previous payslip.
     * A first payslip has nothing to compare against and is never flagged.
     */
    @Transactional(readOnly = true)
    public boolean isFlagged(Payslip current) {
        Variance v = variance(current);
        if (v.previousPayslipId() == null) return false;
        return v.netDeltaPct().abs().compareTo(BigDecimal.valueOf(props.getPayroll().getVarianceThresholdPct())) > 0;
    }

    /** The configured threshold, so callers can explain the flag rather than restate the number. */
    public int thresholdPct() {
        return props.getPayroll().getVarianceThresholdPct();
    }
}
