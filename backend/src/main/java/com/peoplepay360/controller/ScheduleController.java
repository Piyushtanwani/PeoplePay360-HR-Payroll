package com.peoplepay360.controller;

import com.peoplepay360.dto.ScheduleDtos.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import com.peoplepay360.service.ScheduleCrudService;

@RestController
@RequestMapping("/api/schedules")
public class ScheduleController {
    private final ScheduleCrudService service;
    public ScheduleController(ScheduleCrudService service) { this.service = service; }

    @GetMapping("/names")
    public List<ScheduleName> names() { return service.names(); }
    @GetMapping
    public List<ScheduleDto> list() { return service.list(); }
    @GetMapping("/{id}")
    public ScheduleDto get(@PathVariable Long id) { return service.get(id); }
    @PostMapping
    public ScheduleDto create(@Valid @RequestBody SaveSchedule in) { return service.create(in); }
    @PutMapping("/{id}")
    public ScheduleDto update(@PathVariable Long id, @Valid @RequestBody SaveSchedule in) { return service.update(id, in); }
    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) { service.delete(id); }
}
