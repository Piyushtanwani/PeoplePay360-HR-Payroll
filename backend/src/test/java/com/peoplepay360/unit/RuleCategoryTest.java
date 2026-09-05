package com.peoplepay360.unit;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.model.RuleCategory;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RuleCategoryTest {
    @Test
    void parsesCaseInsensitively() {
        assertThat(RuleCategory.parse("basic")).isEqualTo(RuleCategory.BASIC);
        assertThat(RuleCategory.parse(" Deduction ")).isEqualTo(RuleCategory.DEDUCTION);
    }

    @Test
    void refusesAnUnknownCategoryAndSaysWhatIsAllowed() {
        assertThatThrownBy(() -> RuleCategory.parse("BONUS"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("BONUS")
                .hasMessageContaining("ALLOWANCE");
    }

    @Test
    void earningsAndDeductionsAccumulateWhileGrossAndNetReplace() {
        assertThat(RuleCategory.BASIC.accumulates()).isTrue();
        assertThat(RuleCategory.ALLOWANCE.accumulates()).isTrue();
        assertThat(RuleCategory.DEDUCTION.accumulates()).isTrue();
        assertThat(RuleCategory.GROSS.accumulates()).isFalse();
        assertThat(RuleCategory.NET.accumulates()).isFalse();
    }
}
