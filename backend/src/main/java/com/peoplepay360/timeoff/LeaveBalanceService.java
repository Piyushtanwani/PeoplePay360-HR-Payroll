package com.peoplepay360.timeoff;

import com.peoplepay360.common.Money;
import com.peoplepay360.timeoff.TimeOffDtos.LeaveBalance;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/** The single place leave balances are computed. available = approved allocations - approved requests. */
@Service
public class LeaveBalanceService {
    private final TimeOffTypeRepository types;
    private final TimeOffAllocationRepository allocations;
    private final TimeOffRequestRepository requests;

    public LeaveBalanceService(TimeOffTypeRepository types, TimeOffAllocationRepository allocations,
                               TimeOffRequestRepository requests) {
        this.types = types;
        this.allocations = allocations;
        this.requests = requests;
    }

    public List<LeaveBalance> balances(Long employeeId) {
        List<LeaveBalance> out = new ArrayList<>();
        for (TimeOffType t : types.findAll()) {
            if (!t.isActive()) continue;
            out.add(balance(employeeId, t));
        }
        return out;
    }

    public LeaveBalance balance(Long employeeId, TimeOffType t) {
        BigDecimal allocated = allocations.findByEmployeeIdAndTypeIdAndState(employeeId, t.getId(), "APPROVED")
                .stream().map(TimeOffAllocation::getDays).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal taken = requests.findByEmployeeIdAndTypeIdAndState(employeeId, t.getId(), "APPROVED")
                .stream().map(TimeOffRequest::getDays).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pending = sumPending(employeeId, t.getId());
        BigDecimal available = allocated.subtract(taken);
        BigDecimal projected = available.subtract(pending);
        return new LeaveBalance(employeeId, t.getId(), t.getName(), Money.scale(allocated), Money.scale(taken),
                Money.scale(pending), Money.scale(available), Money.scale(projected));
    }

    private BigDecimal sumPending(Long employeeId, Long typeId) {
        BigDecimal p = requests.findByEmployeeIdAndTypeIdAndState(employeeId, typeId, "PENDING")
                .stream().map(TimeOffRequest::getDays).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal n = requests.findByEmployeeIdAndTypeIdAndState(employeeId, typeId, "NEEDS_ATTENTION")
                .stream().map(TimeOffRequest::getDays).reduce(BigDecimal.ZERO, BigDecimal::add);
        return p.add(n);
    }
}
