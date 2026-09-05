package com.peoplepay360.attendance;

import com.peoplepay360.attendance.AttendanceDtos.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {
    private final AttendanceService service;
    public AttendanceController(AttendanceService service) { this.service = service; }

    @GetMapping
    public List<AttendanceDto> list(@RequestParam(required = false) Long employeeId,
                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                    @RequestParam(required = false) String status) {
        return service.list(employeeId, from, to, status);
    }
    @PostMapping("/check-in")
    public AttendanceDto checkIn() { return service.checkIn(); }
    @PostMapping("/check-out")
    public AttendanceDto checkOut() { return service.checkOut(); }
    @GetMapping("/today")
    public TodayView today() { return service.today(); }
    @PostMapping
    public AttendanceDto createManual(@RequestBody ManualRequest in) { return service.createManual(in); }
    @PutMapping("/{id}")
    public AttendanceDto correct(@PathVariable Long id, @RequestBody CorrectRequest in) { return service.correct(id, in); }
    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) { service.delete(id); }
    @GetMapping("/exceptions")
    public List<ExceptionDto> exceptions(@RequestParam String period,
                                         @RequestParam(required = false) Long departmentId,
                                         @RequestParam(required = false) String type,
                                         @RequestParam(required = false) Boolean resolved) {
        return service.exceptions(period, departmentId, type, resolved);
    }
    @PostMapping("/exceptions/{id}/resolve")
    public void resolve(@PathVariable Long id, @RequestBody ResolveRequest in) { service.resolveException(id, in); }
    @PostMapping("/recompute")
    public void recompute(@RequestParam String period) { service.recompute(period); }
}
