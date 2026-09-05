package com.peoplepay360.security;

import com.peoplepay360.common.ApiException;

/**
 * One place that decides what counts as an acceptable password.
 *
 * <p>Previously the invite-redeem path checked a length and the admin-set path checked nothing, so the
 * same account could end up with a password the self-service form would have refused.
 */
public final class PasswordPolicy {
    public static final int MIN_LENGTH = 10;

    private PasswordPolicy() {}

    /**
     * @param email the account's own address, refused as a password because it is the one string an
     *              attacker already knows.
     */
    public static void validate(String password, String email) {
        if (password == null || password.isBlank()) {
            throw ApiException.validation("A password is required.");
        }
        if (password.length() < MIN_LENGTH) {
            throw ApiException.validation("Use at least " + MIN_LENGTH + " characters.");
        }
        boolean hasLetter = password.chars().anyMatch(Character::isLetter);
        boolean hasNonLetter = password.chars().anyMatch(c -> !Character.isLetter(c));
        if (!hasLetter || !hasNonLetter) {
            throw ApiException.validation("Use a mix of letters and at least one number or symbol.");
        }
        if (email != null && password.equalsIgnoreCase(email)) {
            throw ApiException.validation("Your password cannot be your email address.");
        }
    }

    /** The rule as a sentence, so the interface states the same requirement the server enforces. */
    public static String describe() {
        return "At least " + MIN_LENGTH + " characters, mixing letters with at least one number or symbol.";
    }
}
