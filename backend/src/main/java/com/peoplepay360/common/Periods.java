package com.peoplepay360.common;

import java.time.LocalDate;
import java.time.YearMonth;

public final class Periods {
    private Periods() {}
    /** Parses "YYYY-MM" into the first and last day of that month. */
    public static LocalDate[] month(String period) {
        YearMonth ym = YearMonth.parse(period);
        return new LocalDate[]{ ym.atDay(1), ym.atEndOfMonth() };
    }
}
