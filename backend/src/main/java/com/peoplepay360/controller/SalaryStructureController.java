package com.peoplepay360.controller;

import com.peoplepay360.dto.PayrollDtos.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import com.peoplepay360.service.SalaryStructureService;

@RestController
@RequestMapping("/api/salary-structures")
public class SalaryStructureController {
    private final SalaryStructureService service;
    public SalaryStructureController(SalaryStructureService service) { this.service = service; }

    @GetMapping("/names")
    public List<SalaryStructureName> names() { return service.names(); }
    @GetMapping
    public List<SalaryStructureDto> list() { return service.list(); }
    @GetMapping("/{id}")
    public SalaryStructureDto get(@PathVariable Long id) { return service.get(id); }
    @PostMapping
    public SalaryStructureDto create(@Valid @RequestBody SaveStructure in) { return service.create(in); }
    @PutMapping("/{id}")
    public SalaryStructureDto update(@PathVariable Long id, @RequestBody SaveStructure in) { return service.update(id, in); }
    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) { service.delete(id); }

    @PostMapping("/{id}/rules")
    public SalaryRuleDto addRule(@PathVariable Long id, @RequestBody SaveRule in) { return service.addRule(id, in); }
    @PutMapping("/{id}/rules/{ruleId}")
    public SalaryRuleDto updateRule(@PathVariable Long id, @PathVariable Long ruleId, @RequestBody SaveRule in) {
        return service.updateRule(id, ruleId, in);
    }
    @DeleteMapping("/{id}/rules/{ruleId}")
    public void deleteRule(@PathVariable Long id, @PathVariable Long ruleId) { service.deleteRule(id, ruleId); }

    @GetMapping("/formula-help")
    public String formulaHelp() { return service.formulaHelp(); }
}
