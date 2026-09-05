package com.peoplepay360.controller;

import com.peoplepay360.common.PageResponse;
import com.peoplepay360.dto.AttendanceDtos.*;
import com.peoplepay360.service.AttendanceService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {
    private final AttendanceService service;

    public AttendanceController(AttendanceService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<AttendanceDto> list(
            @RequestParam(required = false) Long employeeId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            Pageable pageable) {
        return PageResponse.of(service.list(employeeId, departmentId, from, to, status, q, pageable));
    }

    /** The thresholds the classifier uses, for the "How attendance is classified" help panel. */
    @GetMapping("/rules")
    public AttendanceRules rules() {
        return service.rules();
    }

    @PostMapping("/check-in")
    public AttendanceDto checkIn() {
        return service.checkIn();
    }

    @PostMapping("/check-out")
    public AttendanceDto checkOut() {
        return service.checkOut();
    }

    @GetMapping("/today")
    public TodayView today() {
        return service.today();
    }

    @PostMapping
    public AttendanceDto createManual(@Valid @RequestBody ManualRequest in) {
        return service.createManual(in);
    }

    @PutMapping("/{id}")
    public AttendanceDto correct(@PathVariable Long id, @Valid @RequestBody CorrectRequest in) {
        return service.correct(id, in);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    @GetMapping("/exceptions")
    public PageResponse<ExceptionDto> exceptions(@RequestParam String period,
                                                 @RequestParam(required = false) Long departmentId,
                                                 @RequestParam(required = false) Long employeeId,
                                                 @RequestParam(required = false) String type,
                                                 @RequestParam(required = false) Boolean resolved,
                                                 Pageable pageable) {
        return PageResponse.of(service.exceptions(period, departmentId, employeeId, type, resolved, pageable));
    }

    /** Returns the updated exception so the caller can render the outcome without a refetch. */
    @PostMapping("/exceptions/{id}/resolve")
    public ExceptionDto resolve(@PathVariable Long id, @Valid @RequestBody ResolveRequest in) {
        return service.resolveException(id, in);
    }

    @PostMapping("/recompute")
    public void recompute(@RequestParam String period) {
        service.recompute(period);
    }
}
