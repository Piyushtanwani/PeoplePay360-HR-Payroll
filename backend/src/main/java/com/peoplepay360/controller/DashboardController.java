package com.peoplepay360.controller;

import com.peoplepay360.dto.DashboardDtos.Dashboard;
import com.peoplepay360.dto.DashboardDtos.MyDashboard;
import com.peoplepay360.service.DashboardService;
import com.peoplepay360.service.EmployeeDashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
public class DashboardController {
    private final DashboardService service;
    private final EmployeeDashboardService employeeDashboard;

    public DashboardController(DashboardService service, EmployeeDashboardService employeeDashboard) {
        this.service = service;
        this.employeeDashboard = employeeDashboard;
    }

    /** The HR and payroll dashboard. Payroll figures are omitted entirely without dashboard.read.payroll. */
    @GetMapping("/dashboard")
    public ResponseEntity<Dashboard> dashboard(
            @RequestParam String period,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) String employeeType,
            @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) {
        Dashboard d = service.build(period, departmentId, employeeType);
        String etag = "\"" + Integer.toHexString(d.hashCode()) + "\"";
        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(304).eTag(etag).build();
        }
        return ResponseEntity.ok().eTag(etag).body(d);
    }

    /**
     * The caller's own home screen. Gated on authentication rather than a dashboard permission, because
     * employees hold none and this returns only their own record.
     */
    @GetMapping("/dashboard/me")
    public MyDashboard myDashboard() {
        return employeeDashboard.build();
    }
}
