package com.peoplepay360.unit;

import com.peoplepay360.dto.TimeOffDtos.LeaveBalance;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import com.peoplepay360.model.TimeOffAllocation;
import com.peoplepay360.model.TimeOffRequest;
import com.peoplepay360.model.TimeOffType;
import com.peoplepay360.repository.TimeOffAllocationRepository;
import com.peoplepay360.repository.TimeOffRequestRepository;
import com.peoplepay360.repository.TimeOffTypeRepository;
import com.peoplepay360.service.LeaveBalanceService;

class LeaveBalanceServiceTest {
    private final TimeOffTypeRepository types = mock(TimeOffTypeRepository.class);
    private final TimeOffAllocationRepository allocations = mock(TimeOffAllocationRepository.class);
    private final TimeOffRequestRepository requests = mock(TimeOffRequestRepository.class);
    private final LeaveBalanceService service = new LeaveBalanceService(types, allocations, requests);

    private TimeOffType type() {
        TimeOffType t = new TimeOffType();
        t.setName("Annual Leave");
        t.setRequiresAllocation(true);
        try { var f = TimeOffType.class.getDeclaredField("id"); f.setAccessible(true); f.set(t, 1L); }
        catch (Exception e) { throw new RuntimeException(e); }
        return t;
    }
    private TimeOffAllocation alloc(String days) {
        TimeOffAllocation a = new TimeOffAllocation(); a.setDays(new BigDecimal(days)); return a;
    }
    private TimeOffRequest req(String days) {
        TimeOffRequest r = new TimeOffRequest(); r.setDays(new BigDecimal(days)); return r;
    }

    @Test
    void availableIsAllocatedMinusApprovedProjectedAlsoMinusPending() {
        TimeOffType t = type();
        when(allocations.findByEmployeeIdAndTypeIdAndState(1L, 1L, "APPROVED")).thenReturn(List.of(alloc("10")));
        when(requests.findByEmployeeIdAndTypeIdAndState(1L, 1L, "APPROVED")).thenReturn(List.of());
        when(requests.findByEmployeeIdAndTypeIdAndState(1L, 1L, "PENDING")).thenReturn(List.of(req("3")));
        when(requests.findByEmployeeIdAndTypeIdAndState(1L, 1L, "NEEDS_ATTENTION")).thenReturn(List.of());

        LeaveBalance b = service.balance(1L, t);
        assertThat(b.allocated()).isEqualByComparingTo("10.00");
        assertThat(b.available()).isEqualByComparingTo("10.00");
        assertThat(b.projected()).isEqualByComparingTo("7.00");
    }
}
