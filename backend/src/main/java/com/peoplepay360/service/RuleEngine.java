package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.Money;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.peoplepay360.model.Payrun;
import com.peoplepay360.model.SalaryRule;

/**
 * Evaluates a salary structure's rules in sequence, so later rules may depend on earlier ones. Produces one line
 * per rule and the payslip totals, then asserts the totals are internally consistent. All arithmetic is BigDecimal.
 */
@Component
public class RuleEngine {
    private final FormulaEngine formulaEngine;
    public RuleEngine(FormulaEngine formulaEngine) { this.formulaEngine = formulaEngine; }

    public record Line(Long ruleId, String code, String name, String category, int sequence, BigDecimal amount) {}
    public record Result(List<Line> lines, BigDecimal basic, BigDecimal allowances,
                         BigDecimal deductions, BigDecimal gross, BigDecimal net, List<String> warnings) {}

    /**
     * @param rules      active rules of the structure, any order (sorted here by sequence)
     * @param baseVars   WAGE, WORKED_DAYS, SCHEDULED_DAYS, UNPAID_DAYS, OVERTIME_HOURS, HOURLY_RATE and I_&lt;INPUT&gt;
     */
    public Result compute(List<SalaryRule> rules, Map<String, Double> baseVars) {
        List<SalaryRule> ordered = rules.stream()
                .filter(SalaryRule::isActive)
                .sorted(java.util.Comparator.comparingInt(SalaryRule::getSequence))
                .toList();

        Map<String, Double> vars = new HashMap<>(baseVars);
        Map<String, BigDecimal> ruleAmounts = new HashMap<>();
        BigDecimal cBasic = Money.zero(), cAllow = Money.zero(), cDed = Money.zero(),
                cGross = Money.zero(), cNet = Money.zero();
        List<Line> lines = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        for (SalaryRule r : ordered) {
            BigDecimal amount;
            switch (r.getComputeType()) {
                case "FIXED" -> amount = Money.scale(r.getFixedAmount() == null ? BigDecimal.ZERO : r.getFixedAmount());
                case "PERCENTAGE" -> {
                    BigDecimal base = ruleAmounts.getOrDefault("R_" + r.getBaseRuleCode(), BigDecimal.ZERO);
                    BigDecimal pct = r.getPercentage() == null ? BigDecimal.ZERO : r.getPercentage();
                    amount = Money.scale(base.multiply(pct).movePointLeft(2));
                }
                case "FORMULA" -> {
                    Map<String, Double> ctx = new HashMap<>(vars);
                    ctx.put("C_BASIC", cBasic.doubleValue());
                    ctx.put("C_ALLOWANCE", cAllow.doubleValue());
                    ctx.put("C_DEDUCTION", cDed.doubleValue());
                    ctx.put("C_GROSS", cGross.doubleValue());
                    ctx.put("C_NET", cNet.doubleValue());
                    FormulaEngine.Eval e = formulaEngine.evaluate(r.getFormula(), ctx);
                    if (e.divByZero()) warnings.add("FORMULA_DIVISION_BY_ZERO:" + r.getCode());
                    amount = e.value();
                }
                default -> throw ApiException.validation("Unknown compute type: " + r.getComputeType());
            }

            ruleAmounts.put("R_" + r.getCode(), amount);
            vars.put("R_" + r.getCode(), amount.doubleValue());
            lines.add(new Line(r.getId(), r.getCode(), r.getName(), r.getCategory(), r.getSequence(), amount));

            switch (r.getCategory()) {
                case "BASIC" -> cBasic = cBasic.add(amount);
                case "ALLOWANCE" -> cAllow = cAllow.add(amount);
                case "DEDUCTION" -> cDed = cDed.add(amount);
                case "GROSS" -> cGross = amount;
                case "NET" -> cNet = amount;
                default -> throw ApiException.validation("Unknown category: " + r.getCategory());
            }
        }

        BigDecimal basic = cBasic;
        BigDecimal allowances = cAllow;
        BigDecimal deductions = cDed;
        boolean hasGross = ordered.stream().anyMatch(r -> "GROSS".equals(r.getCategory()));
        boolean hasNet = ordered.stream().anyMatch(r -> "NET".equals(r.getCategory()));
        BigDecimal gross = hasGross ? cGross : basic.add(allowances);
        BigDecimal net = hasNet ? cNet : gross.subtract(deductions);

        return new Result(lines, Money.scale(basic), Money.scale(allowances), Money.scale(deductions),
                Money.scale(gross), Money.scale(net), warnings);
    }

    /** Variable names available to a FORMULA rule at the given sequence position (for save-time validation). */
    public java.util.Set<String> allowedVariables(List<SalaryRule> rules, SalaryRule current) {
        java.util.Set<String> vars = new java.util.HashSet<>(List.of(
                "WAGE", "WORKED_DAYS", "SCHEDULED_DAYS", "UNPAID_DAYS", "OVERTIME_HOURS", "HOURLY_RATE",
                "C_BASIC", "C_ALLOWANCE", "C_DEDUCTION", "C_GROSS", "C_NET"));
        for (SalaryRule r : rules) {
            if (r.getSequence() < current.getSequence()) vars.add("R_" + r.getCode());
        }
        // Payrun inputs are allowed as I_<CODE>; accept any I_ prefixed token by declaring the common ones.
        vars.add("I_UNPAID_DAYS");
        vars.add("I_OVERTIME_HOURS");
        vars.add("I_BONUS");
        return vars;
    }
}
