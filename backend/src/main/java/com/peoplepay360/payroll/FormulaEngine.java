package com.peoplepay360.payroll;

import com.peoplepay360.common.ApiException;
import net.objecthunter.exp4j.Expression;
import net.objecthunter.exp4j.ExpressionBuilder;
import net.objecthunter.exp4j.function.Function;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.Set;

/**
 * Evaluates salary-rule formulas with exp4j, registering the custom functions min, max and round that exp4j
 * does not provide natively. Evaluation returns a BigDecimal scaled to two decimals with HALF_UP rounding.
 * Division by zero evaluates to zero (the caller records a warning).
 */
@Component
public class FormulaEngine {

    private static final Function MIN = new Function("min", 2) {
        @Override public double apply(double... a) { return Math.min(a[0], a[1]); }
    };
    private static final Function MAX = new Function("max", 2) {
        @Override public double apply(double... a) { return Math.max(a[0], a[1]); }
    };
    private static final Function ROUND = new Function("round", 1) {
        @Override public double apply(double... a) {
            return BigDecimal.valueOf(a[0]).setScale(2, RoundingMode.HALF_UP).doubleValue();
        }
    };

    public static final Set<Function> FUNCTIONS = Set.of(MIN, MAX, ROUND);

    /** Result plus a division-by-zero flag. */
    public record Eval(BigDecimal value, boolean divByZero) {}

    public Eval evaluate(String formula, Map<String, Double> variables) {
        try {
            Expression e = new ExpressionBuilder(formula)
                    .functions(MIN, MAX, ROUND)
                    .variables(variables.keySet())
                    .build()
                    .setVariables(variables);
            double result = e.evaluate();
            if (Double.isNaN(result) || Double.isInfinite(result)) {
                return new Eval(BigDecimal.ZERO.setScale(2), true);
            }
            return new Eval(BigDecimal.valueOf(result).setScale(2, RoundingMode.HALF_UP), false);
        } catch (ArithmeticException ex) {
            return new Eval(BigDecimal.ZERO.setScale(2), true);
        } catch (Exception ex) {
            throw ApiException.validation("Formula evaluation failed: " + ex.getMessage());
        }
    }

    /**
     * Validates a formula at save time against the set of variable names allowed at that rule's position.
     * Rejects unknown variables, unknown functions and references to later rules (absent from allowedVars).
     */
    public void validate(String formula, Set<String> allowedVars) {
        try {
            new ExpressionBuilder(formula)
                    .functions(MIN, MAX, ROUND)
                    .variables(allowedVars)
                    .build();
        } catch (Exception ex) {
            throw ApiException.validation("Invalid formula: " + ex.getMessage()
                    + ". Allowed variables at this position: " + allowedVars);
        }
    }
}
