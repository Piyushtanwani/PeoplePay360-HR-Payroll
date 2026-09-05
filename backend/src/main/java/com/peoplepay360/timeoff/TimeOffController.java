package com.peoplepay360.timeoff;

import com.peoplepay360.timeoff.TimeOffDtos.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;

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
    public List<AllocationDto> allocations(@RequestParam(required = false) Long employeeId,
                                           @RequestParam(required = false) String state) {
        return service.listAllocations(employeeId, state);
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
    public List<RequestDto> requests(@RequestParam(required = false) Long employeeId,
                                     @RequestParam(required = false) String state) {
        return service.listRequests(employeeId, state);
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
}
