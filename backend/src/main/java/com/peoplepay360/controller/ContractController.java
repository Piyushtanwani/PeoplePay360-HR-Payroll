package com.peoplepay360.controller;

import com.peoplepay360.common.PageResponse;
import com.peoplepay360.dto.ContractDtos.*;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import com.peoplepay360.service.ContractService;

@RestController
@RequestMapping("/api/contracts")
public class ContractController {
    private final ContractService service;
    public ContractController(ContractService service) { this.service = service; }

    @GetMapping
    public PageResponse<ContractDto> list(
            @RequestParam(required = false) Long employeeId,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endsBefore,
            @RequestParam(required = false) String q,
            Pageable pageable) {
        return PageResponse.of(service.list(employeeId, state, endsBefore, q, pageable));
    }
    @GetMapping("/{id}")
    public ContractDto get(@PathVariable Long id) { return service.get(id); }
    @PostMapping
    public ContractDto create(@Valid @RequestBody CreateContract in) { return service.create(in); }
    @PutMapping("/{id}")
    public ContractDto update(@PathVariable Long id, @RequestBody UpdateContract in) { return service.update(id, in); }
    @PostMapping("/{id}/activate")
    public ContractDto activate(@PathVariable Long id) { return service.activate(id); }
    @PostMapping("/{id}/cancel")
    public ContractDto cancel(@PathVariable Long id) { return service.cancel(id); }
    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) { service.delete(id); }
}
