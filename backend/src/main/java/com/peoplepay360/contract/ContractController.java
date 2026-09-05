package com.peoplepay360.contract;

import com.peoplepay360.contract.ContractDtos.*;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/contracts")
public class ContractController {
    private final ContractService service;
    public ContractController(ContractService service) { this.service = service; }

    @GetMapping
    public List<ContractDto> list(@RequestParam(required = false) Long employeeId,
                                  @RequestParam(required = false) String state,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endsBefore) {
        return service.list(employeeId, state, endsBefore);
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
