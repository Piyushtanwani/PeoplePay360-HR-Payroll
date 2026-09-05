package com.peoplepay360.service;

import com.peoplepay360.model.Contract;
import com.peoplepay360.model.Employee;
import com.peoplepay360.model.WorkingSchedule;
import com.peoplepay360.repository.WorkingScheduleRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

/**
 * Turns a contract and its period inputs into the variables a salary rule may reference.
 *
 * <p>Extracted from the payrun so a dry run computes from exactly the same definitions. When this lived
 * inside the payrun, the seeding path grew its own copy with a hard-coded working week, and the two
 * drifted apart.
 */
@Component
public class PayrollVarsBuilder {
    /** Weeks per month, used to turn a weekly schedule into a monthly hour count. */
    private static final double WEEKS_PER_MONTH = 52.0 / 12.0;

    private final WorkingScheduleRepository schedules;

    public PayrollVarsBuilder(WorkingScheduleRepository schedules) {
        this.schedules = schedules;
    }

    /**
     * @param effective the period inputs, exposed both bare (WORKED_DAYS) and prefixed (I_WORKED_DAYS),
     *                  because rules written either way are both in circulation.
     */
    public Map<String, Double> build(Contract contract, Employee employee, Map<String, BigDecimal> effective) {
        Map<String, Double> vars = new HashMap<>();
        vars.put("WAGE", contract.getWage() == null ? 0d : contract.getWage().doubleValue());
        for (Map.Entry<String, BigDecimal> entry : effective.entrySet()) {
            double value = entry.getValue() == null ? 0d : entry.getValue().doubleValue();
            vars.put(entry.getKey(), value);
            vars.put("I_" + entry.getKey(), value);
        }
        vars.put("HOURLY_RATE", hourlyRate(contract, employee));
        return vars;
    }

    /**
     * An hourly contract states the rate directly. Any other wage type derives it from the schedule, and
     * an employee with no schedule has no derivable rate, so it is zero rather than a guess.
     */
    private double hourlyRate(Contract contract, Employee employee) {
        if (contract.getWage() == null) return 0d;
        if ("HOURLY".equals(contract.getWageType())) return contract.getWage().doubleValue();
        double monthlyHours = weeklyHours(contract, employee).doubleValue() * WEEKS_PER_MONTH;
        if (monthlyHours <= 0) return 0d;
        return BigDecimal.valueOf(contract.getWage().doubleValue() / monthlyHours)
                .setScale(4, RoundingMode.HALF_UP)
                .doubleValue();
    }

    /** The contract's schedule wins over the employee's, because the contract is what payroll pays against. */
    private BigDecimal weeklyHours(Contract contract, Employee employee) {
        Long scheduleId = contract.getWorkingScheduleId() != null
                ? contract.getWorkingScheduleId()
                : employee.getWorkingScheduleId();
        if (scheduleId == null) return BigDecimal.ZERO;
        return schedules.findById(scheduleId).map(WorkingSchedule::getWeeklyHours).orElse(BigDecimal.ZERO);
    }
}
