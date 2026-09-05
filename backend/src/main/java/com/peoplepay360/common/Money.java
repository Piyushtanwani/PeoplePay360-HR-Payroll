package com.peoplepay360.common;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class Money {
    private Money() {}
    public static final int SCALE = 2;
    public static BigDecimal scale(BigDecimal v) {
        return v == null ? BigDecimal.ZERO.setScale(SCALE) : v.setScale(SCALE, RoundingMode.HALF_UP);
    }
    public static BigDecimal zero() { return BigDecimal.ZERO.setScale(SCALE); }
}
