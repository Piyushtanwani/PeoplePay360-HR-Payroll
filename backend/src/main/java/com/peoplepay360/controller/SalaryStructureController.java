package com.peoplepay360.controller;

import com.peoplepay360.common.PageResponse;
import com.peoplepay360.dto.PayrollDtos.*;
import com.peoplepay360.service.SalaryDryRunService;
import com.peoplepay360.service.SalaryStructureService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/salary-structures")
public class SalaryStructureController {
    private final SalaryStructureService service;
    private final SalaryDryRunService dryRunService;

    public SalaryStructureController(SalaryStructureService service, SalaryDryRunService dryRunService) {
        this.service = service;
        this.dryRunService = dryRunService;
    }

    @GetMapping("/names")
    public List<SalaryStructureName> names() {
        return service.names();
    }

    @GetMapping
    public PageResponse<SalaryStructureDto> list(@RequestParam(required = false) String q,
                                                 @RequestParam(required = false) Boolean active,
                                                 Pageable pageable) {
        return PageResponse.of(service.list(q, active, pageable));
    }

    @GetMapping("/{id}")
    public SalaryStructureDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    public SalaryStructureDto create(@Valid @RequestBody SaveStructure in) {
        return service.create(in);
    }

    @PutMapping("/{id}")
    public SalaryStructureDto update(@PathVariable Long id, @Valid @RequestBody SaveStructure in) {
        return service.update(id, in);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    /** Every rule across every structure, for the cross-structure Salary Rules screen. */
    @GetMapping("/rules/all")
    public PageResponse<SalaryRuleRow> allRules(@RequestParam(required = false) String q,
                                                @RequestParam(required = false) Long structureId,
                                                @RequestParam(required = false) String category,
                                                @RequestParam(required = false) Boolean active,
                                                Pageable pageable) {
        return PageResponse.of(service.allRules(q, structureId, category, active, pageable));
    }

    @PostMapping("/{id}/rules")
    public SalaryRuleDto addRule(@PathVariable Long id, @Valid @RequestBody SaveRule in) {
        return service.addRule(id, in);
    }

    @PutMapping("/{id}/rules/reorder")
    public SalaryStructureDto reorderRules(@PathVariable Long id, @Valid @RequestBody ReorderRules in) {
        return service.reorderRules(id, in);
    }

    @PutMapping("/{id}/rules/{ruleId}")
    public SalaryRuleDto updateRule(@PathVariable Long id, @PathVariable Long ruleId,
                                    @Valid @RequestBody SaveRule in) {
        return service.updateRule(id, ruleId, in);
    }

    /** Switches a rule on or off without deleting it, so the change is reversible. */
    @PatchMapping("/{id}/rules/{ruleId}/active")
    public SalaryRuleDto setRuleActive(@PathVariable Long id, @PathVariable Long ruleId,
                                       @Valid @RequestBody SetRuleActive in) {
        return service.setRuleActive(id, ruleId, in.active());
    }

    @DeleteMapping("/{id}/rules/{ruleId}")
    public void deleteRule(@PathVariable Long id, @PathVariable Long ruleId) {
        service.deleteRule(id, ruleId);
    }

    /** Simulates the structure against real employees and persists nothing. */
    @PostMapping("/{id}/dry-run")
    public DryRunResult dryRun(@PathVariable Long id, @Valid @RequestBody DryRunRequest in) {
        return dryRunService.run(id, in);
    }

    @GetMapping("/formula-help")
    public FormulaHelp formulaHelp() {
        return service.formulaHelp();
    }
}
