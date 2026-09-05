package com.peoplepay360.controller;

import com.peoplepay360.common.PageResponse;
import com.peoplepay360.dto.TimeOffDtos.*;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import com.peoplepay360.service.TimeOffService;

@RestController
@RequestMapping("/api/timeoff")
public class TimeOffController {
    private final TimeOffService service;
    public TimeOffController(TimeOffService service) { this.service = service; }

    // types
    @GetMapping("/types")
    public List<TypeDto> listTypes() { return service.listTypes(); }
    @PostMapping("/types")
    public TypeDto createType(@RequestBody SaveType in) { return service.saveType(null, in); }
    @PutMapping("/types/{id}")
    public TypeDto updateType(@PathVariable Long id, @RequestBody SaveType in) { return service.saveType(id, in); }

    // balances
    @GetMapping("/balances")
    public List<LeaveBalance> balances(@RequestParam(required = false) Long employeeId) {
        return service.balances(employeeId);
    }

    // allocations
    @GetMapping("/allocations")
    public PageResponse<AllocationDto> allocations(@RequestParam(required = false) Long employeeId,
                                                   @RequestParam(required = false) String state,
                                                   @RequestParam(required = false) Long typeId,
                                                   Pageable pageable) {
        return PageResponse.of(service.listAllocations(employeeId, state, typeId, pageable));
    }
    @PostMapping("/allocations")
    public AllocationDto createAllocation(@Valid @RequestBody CreateAllocation in) {
        return service.createAllocation(in);
    }
    @PostMapping("/allocations/{id}/approve")
    public AllocationDto approveAllocation(@PathVariable Long id, @RequestBody(required = false) Decision in) {
        return service.decideAllocation(id, true, in);
    }
    @PostMapping("/allocations/{id}/refuse")
    public AllocationDto refuseAllocation(@PathVariable Long id, @RequestBody(required = false) Decision in) {
        return service.decideAllocation(id, false, in);
    }

    // requests
    @GetMapping("/requests")
    public PageResponse<RequestDto> requests(
            @RequestParam(required = false) Long employeeId,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) Long typeId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Pageable pageable) {
        return PageResponse.of(service.listRequests(employeeId, state, typeId, departmentId, from, to, pageable));
    }
    @GetMapping("/requests/{id}")
    public RequestDto getRequest(@PathVariable Long id) { return service.getRequest(id); }
    @PostMapping("/requests")
    public RequestDto createRequest(@Valid @RequestBody CreateRequest in) { return service.createRequest(in); }
    @PostMapping("/requests/simulate")
    public SimulateResult simulate(@Valid @RequestBody SimulateRequest in) { return service.simulate(in); }
    @PostMapping("/requests/{id}/approve")
    public RequestDto approveRequest(@PathVariable Long id, @RequestBody(required = false) Decision in) {
        return service.decideRequest(id, true, in);
    }
    @PostMapping("/requests/{id}/refuse")
    public RequestDto refuseRequest(@PathVariable Long id, @RequestBody(required = false) Decision in) {
        return service.decideRequest(id, false, in);
    }
    @PostMapping("/requests/{id}/cancel")
    public RequestDto cancelRequest(@PathVariable Long id) { return service.cancel(id); }

    // holidays
    @GetMapping("/holidays")
    public List<HolidayDto> holidays(@RequestParam int year) { return service.holidays(year); }

    @PostMapping("/holidays")
    public HolidayDto createHoliday(@Valid @RequestBody SaveHoliday in) { return service.createHoliday(in); }

    @DeleteMapping("/holidays/{id}")
    public void deleteHoliday(@PathVariable Long id) { service.deleteHoliday(id); }
}
