package com.peoplepay360.payroll;

import com.peoplepay360.attendance.Attendance;
import com.peoplepay360.attendance.AttendanceRepository;
import com.peoplepay360.contract.Contract;
import com.peoplepay360.employee.Employee;
import com.peoplepay360.schedule.ScheduleService;
import com.peoplepay360.schedule.WorkingSchedule;
import com.peoplepay360.schedule.WorkingScheduleRepository;
import com.peoplepay360.timeoff.PublicHolidayRepository;
import com.peoplepay360.timeoff.TimeOffRequest;
import com.peoplepay360.timeoff.TimeOffRequestRepository;
import com.peoplepay360.timeoff.TimeOffType;
import com.peoplepay360.timeoff.TimeOffTypeRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** Derives the period inputs that feed the salary rule engine: scheduled, worked and unpaid days, and overtime hours. */
@Component
public class PayrollInputsBuilder {
    private final AttendanceRepository attendance;
    private final TimeOffRequestRepository requests;
    private final TimeOffTypeRepository types;
    private final PublicHolidayRepository holidays;
    private final WorkingScheduleRepository schedules;
    private final ScheduleService scheduleService;

    public PayrollInputsBuilder(AttendanceRepository attendance, TimeOffRequestRepository requests,
                                TimeOffTypeRepository types, PublicHolidayRepository holidays,
                                WorkingScheduleRepository schedules, ScheduleService scheduleService) {
        this.attendance = attendance;
        this.requests = requests;
        this.types = types;
        this.holidays = holidays;
        this.schedules = schedules;
        this.scheduleService = scheduleService;
    }

    public record Inputs(BigDecimal scheduledDays, BigDecimal workedDays, BigDecimal unpaidDays,
                         BigDecimal overtimeHours) {}

    public Inputs build(Employee employee, Contract contract, LocalDate periodStart, LocalDate periodEnd) {
        WorkingSchedule schedule = null;
        Long scheduleId = contract.getWorkingScheduleId() != null
                ? contract.getWorkingScheduleId() : employee.getWorkingScheduleId();
        if (scheduleId != null) schedule = schedules.findById(scheduleId).orElse(null);

        Set<LocalDate> hol = new HashSet<>();
        holidays.findByDateBetween(periodStart, periodEnd).forEach(h -> hol.add(h.getDate()));

        int scheduledDays;
        if (schedule != null) {
            scheduledDays = scheduleService.workingDays(schedule, periodStart, periodEnd, hol).size();
        } else {
            scheduledDays = (int) periodStart.datesUntil(periodEnd.plusDays(1))
                    .filter(d -> d.getDayOfWeek().getValue() <= 5 && !hol.contains(d)).count();
        }

        // Unpaid days: approved requests of unpaid types intersecting the period.
        Map<Long, TimeOffType> typeCache = new HashMap<>();
        types.findAll().forEach(t -> typeCache.put(t.getId(), t));
        BigDecimal unpaid = BigDecimal.ZERO;
        BigDecimal paidLeave = BigDecimal.ZERO;
        for (TimeOffRequest r : requests.findApprovedOverlapping(employee.getId(), periodStart, periodEnd)) {
            TimeOffType t = typeCache.get(r.getTypeId());
            if (t == null) continue;
            if (t.isPaid()) paidLeave = paidLeave.add(r.getDays());
            else unpaid = unpaid.add(r.getDays());
        }

        // Worked days: distinct attendance work dates with a check-out in the period, plus paid-leave days.
        Set<LocalDate> workedDates = new HashSet<>();
        int overtimeMinutes = 0;
        for (Attendance a : attendance.findRange(employee.getId(), periodStart, periodEnd)) {
            if (a.getCheckOut() != null) workedDates.add(a.getWorkDate());
            if ("OVERTIME".equals(a.getStatus())) {
                overtimeMinutes += Math.max(0, a.getWorkedMinutes() - a.getScheduledMinutes());
            }
        }
        BigDecimal workedDays = BigDecimal.valueOf(workedDates.size()).add(paidLeave);

        return new Inputs(
                BigDecimal.valueOf(scheduledDays),
                workedDays,
                unpaid,
                BigDecimal.valueOf(overtimeMinutes).divide(BigDecimal.valueOf(60), 2, java.math.RoundingMode.HALF_UP));
    }
}
