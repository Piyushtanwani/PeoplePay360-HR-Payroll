package com.peoplepay360.unit;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.service.FormulaEngine;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FormulaEngineTest {
    private final FormulaEngine engine = new FormulaEngine();

    @Test
    void evaluatesArithmeticAndCustomFunctions() {
        assertThat(engine.evaluate("max(0, (61000 - 25000) * 0.10)", Map.of()).value())
                .isEqualByComparingTo("3600.00");
        assertThat(engine.evaluate("min(5, 3)", Map.of()).value()).isEqualByComparingTo("3.00");
        assertThat(engine.evaluate("round(10.126)", Map.of()).value()).isEqualByComparingTo("10.13");
    }

    @Test
    void divisionByZeroReturnsZeroWithFlag() {
        FormulaEngine.Eval e = engine.evaluate("WAGE / SCHEDULED_DAYS * UNPAID_DAYS",
                Map.of("WAGE", 50000.0, "SCHEDULED_DAYS", 0.0, "UNPAID_DAYS", 2.0));
        assertThat(e.divByZero()).isTrue();
        assertThat(e.value()).isEqualByComparingTo("0.00");
    }

    @Test
    void validateRejectsUnknownVariable() {
        assertThatThrownBy(() -> engine.validate("BONUS + WAGE", Set.of("WAGE")))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void validateAcceptsKnownVariables() {
        engine.validate("WAGE / SCHEDULED_DAYS * UNPAID_DAYS", Set.of("WAGE", "SCHEDULED_DAYS", "UNPAID_DAYS"));
    }
}
