package com.peoplepay360.controller;

import com.peoplepay360.common.PageResponse;
import com.peoplepay360.dto.ScheduleDtos.*;
import com.peoplepay360.service.ScheduleCrudService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/schedules")
public class ScheduleController {
    private final ScheduleCrudService service;

    public ScheduleController(ScheduleCrudService service) {
        this.service = service;
    }

    @GetMapping("/names")
    public List<ScheduleName> names() {
        return service.names();
    }

    @GetMapping
    public PageResponse<ScheduleDto> list(@RequestParam(required = false) String q,
                                          @RequestParam(required = false) Boolean active,
                                          Pageable pageable) {
        return PageResponse.of(service.list(q, active, pageable));
    }

    @GetMapping("/{id}")
    public ScheduleDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    public ScheduleDto create(@Valid @RequestBody SaveSchedule in) {
        return service.create(in);
    }

    @PutMapping("/{id}")
    public ScheduleDto update(@PathVariable Long id, @Valid @RequestBody SaveSchedule in) {
        return service.update(id, in);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
