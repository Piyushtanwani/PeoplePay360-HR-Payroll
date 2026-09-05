package com.peoplepay360.unit;

import com.peoplepay360.service.FormulaEngine;
import com.peoplepay360.service.RuleEngine;
import com.peoplepay360.model.SalaryRule;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Verifies the sequenced salary rule engine against the seeded "Standard Monthly" structure. */
class RuleEngineTest {
    private final RuleEngine engine = new RuleEngine(new FormulaEngine());

    private SalaryRule rule(String name, String code, String category, int seq, String type,
                            BigDecimal fixed, BigDecimal pct, String base, String formula) {
        SalaryRule r = new SalaryRule();
        r.setName(name); r.setCode(code); r.setCategory(category); r.setSequence(seq);
        r.setComputeType(type); r.setFixedAmount(fixed); r.setPercentage(pct);
        r.setBaseRuleCode(base); r.setFormula(formula); r.setActive(true);
        return r;
    }

    private List<SalaryRule> standardMonthly() {
        List<SalaryRule> rules = new ArrayList<>();
        rules.add(rule("Basic", "BASIC", "BASIC", 10, "FORMULA", null, null, null, "WAGE"));
        rules.add(rule("HRA", "HRA", "ALLOWANCE", 20, "PERCENTAGE", null, new BigDecimal("20"), "BASIC", null));
        rules.add(rule("Transport", "TRANSPORT", "ALLOWANCE", 30, "FIXED", new BigDecimal("1000"), null, null, null));
        rules.add(rule("Overtime", "OVERTIME", "ALLOWANCE", 40, "FORMULA", null, null, null, "HOURLY_RATE * 1.5 * OVERTIME_HOURS"));
        rules.add(rule("Gross", "GROSS", "GROSS", 50, "FORMULA", null, null, null, "C_BASIC + C_ALLOWANCE"));
        rules.add(rule("Unpaid", "UNPAID_DED", "DEDUCTION", 60, "FORMULA", null, null, null, "WAGE / SCHEDULED_DAYS * UNPAID_DAYS"));
        rules.add(rule("PF", "PF", "DEDUCTION", 70, "PERCENTAGE", null, new BigDecimal("12"), "BASIC", null));
        rules.add(rule("Tax", "TAX", "DEDUCTION", 80, "FORMULA", null, null, null, "max(0, (R_GROSS - 25000) * 0.10)"));
        rules.add(rule("Net", "NET", "NET", 90, "FORMULA", null, null, null, "C_GROSS - C_DEDUCTION"));
        return rules;
    }

    private Map<String, Double> vars(double wage, double scheduled, double unpaid, double overtime) {
        Map<String, Double> v = new HashMap<>();
        v.put("WAGE", wage);
        v.put("SCHEDULED_DAYS", scheduled);
        v.put("WORKED_DAYS", scheduled - unpaid);
        v.put("UNPAID_DAYS", unpaid);
        v.put("OVERTIME_HOURS", overtime);
        v.put("HOURLY_RATE", wage / (37.5 * 52 / 12));
        return v;
    }

    @Test
    void fullMonthNoUnpaidNoOvertime() {
        RuleEngine.Result r = engine.compute(standardMonthly(), vars(50000, 22, 0, 0));
        assertThat(r.basic()).isEqualByComparingTo("50000.00");
        assertThat(r.allowances()).isEqualByComparingTo("11000.00"); // HRA 10000 + Transport 1000
        assertThat(r.gross()).isEqualByComparingTo("61000.00");
        assertThat(r.deductions()).isEqualByComparingTo("9600.00"); // PF 6000 + Tax 3600
        assertThat(r.net()).isEqualByComparingTo("51400.00");
    }

    @Test
    void unpaidDaysReduceNetThroughDeduction() {
        RuleEngine.Result r = engine.compute(standardMonthly(), vars(50000, 22, 2, 0));
        BigDecimal unpaid = r.lines().stream().filter(l -> l.code().equals("UNPAID_DED"))
                .findFirst().orElseThrow().amount();
        assertThat(unpaid).isEqualByComparingTo("4545.45"); // 50000/22*2
        assertThat(r.net()).isEqualByComparingTo(r.gross().subtract(r.deductions()));
    }

    @Test
    void overtimeAddsAllowance() {
        RuleEngine.Result r = engine.compute(standardMonthly(), vars(50000, 22, 0, 6));
        BigDecimal ot = r.lines().stream().filter(l -> l.code().equals("OVERTIME"))
                .findFirst().orElseThrow().amount();
        assertThat(ot).isGreaterThan(BigDecimal.ZERO); // HOURLY_RATE * 1.5 * 6
        assertThat(r.gross()).isEqualByComparingTo(r.basic().add(r.allowances()));
    }

    @Test
    void netAlwaysEqualsGrossMinusDeductions() {
        for (int unpaid = 0; unpaid <= 5; unpaid++) {
            RuleEngine.Result r = engine.compute(standardMonthly(), vars(40000, 20, unpaid, 0));
            assertThat(r.net()).isEqualByComparingTo(r.gross().subtract(r.deductions()));
        }
    }
}
