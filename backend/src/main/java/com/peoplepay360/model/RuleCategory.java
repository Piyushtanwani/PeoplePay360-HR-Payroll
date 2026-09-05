package com.peoplepay360.model;

import com.peoplepay360.common.ApiException;

import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * The five buckets a salary rule can contribute to. Previously this list was written out twice, once
 * in the rule validator and once in the engine's accumulator, which is two places to forget.
 *
 * <p>BASIC, ALLOWANCE and DEDUCTION accumulate: several rules add together. GROSS and NET assign:
 * an explicit rule of that category replaces the running figure rather than adding to it.
 */
public enum RuleCategory {
    BASIC(true),
    ALLOWANCE(true),
    DEDUCTION(true),
    GROSS(false),
    NET(false);

    private final boolean accumulates;

    RuleCategory(boolean accumulates) {
        this.accumulates = accumulates;
    }

    /** True when several rules of this category add together, false when a later rule replaces the total. */
    public boolean accumulates() {
        return accumulates;
    }

    /** Parses a stored category string, raising a 400 rather than failing later in the engine. */
    public static RuleCategory parse(String value) {
        if (value == null) throw ApiException.validation("A rule category is required. " + allowed());
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw ApiException.validation("Unknown category: " + value + ". " + allowed());
        }
    }

    public static String allowed() {
        return "Allowed categories: "
                + Arrays.stream(values()).map(Enum::name).collect(Collectors.joining(", ")) + ".";
    }
}
