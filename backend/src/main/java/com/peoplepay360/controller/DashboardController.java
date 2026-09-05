package com.peoplepay360.controller;

import com.peoplepay360.dto.DashboardDtos.Dashboard;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.peoplepay360.service.DashboardService;

@RestController
@RequestMapping("/api/reports")
public class DashboardController {
    private final DashboardService service;
    public DashboardController(DashboardService service) { this.service = service; }

    @GetMapping("/dashboard")
    public ResponseEntity<Dashboard> dashboard(@RequestParam String period,
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
}
