package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.dto.PayrollDtos.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import com.peoplepay360.model.SalaryRule;
import com.peoplepay360.model.SalaryStructure;
import com.peoplepay360.repository.SalaryRuleRepository;
import com.peoplepay360.repository.SalaryStructureRepository;

@Service
public class SalaryStructureService {
    private final SalaryStructureRepository structures;
    private final SalaryRuleRepository rules;
    private final RuleEngine ruleEngine;
    private final FormulaEngine formulaEngine;
    private final AuditService audit;

    public SalaryStructureService(SalaryStructureRepository structures, SalaryRuleRepository rules,
                                  RuleEngine ruleEngine, FormulaEngine formulaEngine, AuditService audit) {
        this.structures = structures;
        this.rules = rules;
        this.ruleEngine = ruleEngine;
        this.formulaEngine = formulaEngine;
        this.audit = audit;
    }

    @PreAuthorize("hasAuthority('salary_structure.list_names')")
    @Transactional(readOnly = true)
    public List<SalaryStructureName> names() {
        return structures.findAll().stream().map(s -> new SalaryStructureName(s.getId(), s.getName())).toList();
    }

    @PreAuthorize("hasAuthority('salary_structure.read')")
    @Transactional(readOnly = true)
    public List<SalaryStructureDto> list() {
        return structures.findAll().stream().map(this::toDto).toList();
    }

    @PreAuthorize("hasAuthority('salary_structure.read')")
    @Transactional(readOnly = true)
    public SalaryStructureDto get(Long id) {
        return toDto(structures.findById(id).orElseThrow(() -> ApiException.notFound("structure")));
    }

    @PreAuthorize("hasAuthority('salary_structure.create')")
    @Transactional
    public SalaryStructureDto create(SaveStructure in) {
        SalaryStructure s = new SalaryStructure();
        s.setName(in.name());
        s.setCode(in.code());
        s.setActive(in.active() == null || in.active());
        return toDto(structures.save(s));
    }

    @PreAuthorize("hasAuthority('salary_structure.update')")
    @Transactional
    public SalaryStructureDto update(Long id, SaveStructure in) {
        SalaryStructure s = structures.findById(id).orElseThrow(() -> ApiException.notFound("structure"));
        if (in.name() != null) s.setName(in.name());
        if (in.code() != null) s.setCode(in.code());
        if (in.active() != null) s.setActive(in.active());
        return toDto(s);
    }

    @PreAuthorize("hasAuthority('salary_structure.delete')")
    @Transactional
    public void delete(Long id) {
        // Refuse when used by any payrun's payslips would be ideal; keep simple: block if structure has versions in use
        structures.findById(id).orElseThrow(() -> ApiException.notFound("structure"));
        structures.deleteById(id);
    }

    @PreAuthorize("hasAuthority('salary_rule.create')")
    @Transactional
    public SalaryRuleDto addRule(Long structureId, SaveRule in) {
        SalaryStructure s = structures.findById(structureId).orElseThrow(() -> ApiException.notFound("structure"));
        SalaryRule r = new SalaryRule();
        applyRule(r, in, s);
        validateRule(r, s);
        s.getRules().add(r);
        structures.saveAndFlush(s);
        // Re-fetch to obtain the DB-generated ID (cascade via @JoinColumn does not back-populate the transient entity)
        SalaryRule saved = structures.findById(structureId)
                .flatMap(st -> st.getRules().stream()
                        .filter(x -> x.getCode().equals(r.getCode()) && x.getSequence() == r.getSequence())
                        .reduce((a, b) -> b))
                .orElse(r);
        audit.record(Channel.UI, "ADD_RULE", "salary_structure", structureId.toString(), "ALLOW", saved.getCode(), null, null);
        return toRuleDto(saved);
    }

    @PreAuthorize("hasAuthority('salary_rule.update')")
    @Transactional
    public SalaryRuleDto updateRule(Long structureId, Long ruleId, SaveRule in) {
        SalaryStructure s = structures.findById(structureId).orElseThrow(() -> ApiException.notFound("structure"));
        SalaryRule r = s.getRules().stream().filter(x -> x.getId().equals(ruleId)).findFirst()
                .orElseThrow(() -> ApiException.notFound("rule"));
        applyRule(r, in, s);
        validateRule(r, s);
        structures.save(s);
        return toRuleDto(r);
    }

    @PreAuthorize("hasAuthority('salary_rule.delete')")
    @Transactional
    public void deleteRule(Long structureId, Long ruleId) {
        SalaryStructure s = structures.findById(structureId).orElseThrow(() -> ApiException.notFound("structure"));
        s.getRules().removeIf(x -> x.getId().equals(ruleId));
        structures.save(s);
    }

    @PreAuthorize("hasAuthority('salary_structure.dry_run')")
    @Transactional(readOnly = true)
    public FormulaHelp formulaHelp() {
        List<FormulaVariable> variables = List.of(
                new FormulaVariable("WAGE", "Contract wage for the period."),
                new FormulaVariable("WORKED_DAYS", "Days actually worked in the period."),
                new FormulaVariable("SCHEDULED_DAYS", "Days the working schedule expects."),
                new FormulaVariable("UNPAID_DAYS", "Unpaid leave days deducted from the period."),
                new FormulaVariable("OVERTIME_HOURS", "Overtime hours recorded from attendance."),
                new FormulaVariable("HOURLY_RATE", "Wage divided by scheduled hours."),
                new FormulaVariable("R_<RULECODE>", "Result of an earlier rule, by its code."),
                new FormulaVariable("C_BASIC", "Running total of the BASIC category."),
                new FormulaVariable("C_ALLOWANCE", "Running total of the ALLOWANCE category."),
                new FormulaVariable("C_DEDUCTION", "Running total of the DEDUCTION category."),
                new FormulaVariable("C_GROSS", "Running total of the GROSS category."),
                new FormulaVariable("C_NET", "Running total of the NET category."),
                new FormulaVariable("I_<INPUTCODE>", "Payrun input value, by its code."));
        List<String> functions = List.of("min(a,b)", "max(a,b)", "abs(a)", "round(a)", "floor(a)", "ceil(a)");
        return new FormulaHelp(variables, functions, "C_BASIC * WORKED_DAYS / SCHEDULED_DAYS");
    }

    private void applyRule(SalaryRule r, SaveRule in, SalaryStructure s) {
        if (in.name() != null) r.setName(in.name());
        if (in.code() != null) r.setCode(in.code().toUpperCase());
        if (in.category() != null) r.setCategory(in.category());
        if (in.sequence() != null) r.setSequence(in.sequence());
        if (in.computeType() != null) r.setComputeType(in.computeType());
        r.setFixedAmount(in.fixedAmount());
        r.setPercentage(in.percentage());
        r.setBaseRuleCode(in.baseRuleCode());
        r.setFormula(in.formula());
        if (in.active() != null) r.setActive(in.active());
        r.setDescription(in.description());
    }

    private void validateRule(SalaryRule r, SalaryStructure s) {
        if (!List.of("BASIC", "ALLOWANCE", "GROSS", "DEDUCTION", "NET").contains(r.getCategory())) {
            throw ApiException.validation("Unknown category: " + r.getCategory());
        }
        switch (r.getComputeType()) {
            case "FIXED" -> {
                if (r.getFixedAmount() == null) throw ApiException.validation("Fixed amount is required.");
            }
            case "PERCENTAGE" -> {
                if (r.getPercentage() == null || r.getBaseRuleCode() == null) {
                    throw ApiException.validation("Percentage and base rule code are required.");
                }
                boolean baseEarlier = s.getRules().stream()
                        .anyMatch(x -> x.getCode().equals(r.getBaseRuleCode()) && x.getSequence() < r.getSequence());
                if (!baseEarlier) throw ApiException.validation("Base rule must be an earlier rule.");
            }
            case "FORMULA" -> {
                if (r.getFormula() == null || r.getFormula().isBlank()) {
                    throw ApiException.validation("Formula is required.");
                }
                formulaEngine.validate(r.getFormula(), ruleEngine.allowedVariables(s.getRules(), r));
            }
            default -> throw ApiException.validation("Unknown compute type: " + r.getComputeType());
        }
    }

    public SalaryStructureDto toDto(SalaryStructure s) {
        List<SalaryRuleDto> ruleDtos = s.getRules().stream().map(this::toRuleDto).toList();
        return new SalaryStructureDto(s.getId(), s.getName(), s.getCode(), s.isActive(),
                ruleDtos.size(), 0, ruleDtos);
    }
    private SalaryRuleDto toRuleDto(SalaryRule r) {
        return new SalaryRuleDto(r.getId(), r.getStructureId(), r.getName(), r.getCode(), r.getCategory(),
                r.getSequence(), r.getComputeType(), r.getFixedAmount(), r.getPercentage(), r.getBaseRuleCode(),
                r.getFormula(), r.isActive(), r.getDescription());
    }
}
