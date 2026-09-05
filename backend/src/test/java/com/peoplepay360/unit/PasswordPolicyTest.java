package com.peoplepay360.unit;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.security.PasswordPolicy;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PasswordPolicyTest {
    @Test
    void acceptsAPasswordThatMeetsTheRule() {
        assertThatCode(() -> PasswordPolicy.validate("Correct-Horse-9", "sam@example.com"))
                .doesNotThrowAnyException();
    }

    @Test
    void refusesAnEmptyPassword() {
        assertThatThrownBy(() -> PasswordPolicy.validate("  ", "sam@example.com"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void refusesSomethingShorterThanTheMinimum() {
        assertThatThrownBy(() -> PasswordPolicy.validate("Short-1", "sam@example.com"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining(String.valueOf(PasswordPolicy.MIN_LENGTH));
    }

    @Test
    void refusesLettersAlone() {
        assertThatThrownBy(() -> PasswordPolicy.validate("passwordpassword", "sam@example.com"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("number or symbol");
    }

    @Test
    void refusesDigitsAlone() {
        assertThatThrownBy(() -> PasswordPolicy.validate("1234567890123", "sam@example.com"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void refusesTheAccountsOwnEmailAddress() {
        assertThatThrownBy(() -> PasswordPolicy.validate("Sam@Example.com", "sam@example.com"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("email");
    }
}
