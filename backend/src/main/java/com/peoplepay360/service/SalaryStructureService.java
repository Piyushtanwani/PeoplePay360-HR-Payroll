package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.Paging;
import com.peoplepay360.common.Specs;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.dto.PayrollDtos.*;
import com.peoplepay360.model.RuleCategory;
import com.peoplepay360.model.SalaryRule;
import com.peoplepay360.model.SalaryStructure;
import com.peoplepay360.repository.ContractRepository;
import com.peoplepay360.repository.PayrunRepository;
import com.peoplepay360.repository.SalaryRuleRepository;
import com.peoplepay360.repository.SalaryStructureRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Salary structures and the rules inside them.
 *
 * <p>A structure owns an ordered list of rules; payroll runs them in sequence, so a rule may depend on
 * any rule before it and on none after it. That ordering is the invariant this class defends: every
 * write revalidates the affected rules against their neighbours, and reordering revalidates all of them.
 *
 * <p>Simulation lives in {@link SalaryDryRunService}, which needs the payroll repositories this class
 * deliberately does not have.
 */
@Service
public class SalaryStructureService {
    private static final Map<String, String> STRUCTURE_SORTS =
            Map.of("name", "name", "code", "code", "active", "active");
    private static final Sort STRUCTURE_DEFAULT = Sort.by(Sort.Order.asc("name"));

    /** structureName is a joined column, hence the alias rather than a plain property. */
    private static final Map<String, String> RULE_SORTS = Map.of(
            "structureName", "structure.name", "sequence", "sequence", "name", "name",
            "code", "code", "category", "category", "computeType", "computeType", "active", "active");
    private static final Sort RULE_DEFAULT =
            Sort.by(Sort.Order.asc("structure.name"), Sort.Order.asc("sequence"));

    private final SalaryStructureRepository structures;
    private final SalaryRuleRepository rules;
    private final ContractRepository contracts;
    private final PayrunRepository payruns;
    private final RuleEngine ruleEngine;
    private final FormulaEngine formulaEngine;
    private final AuditService audit;

    public SalaryStructureService(SalaryStructureRepository structures, SalaryRuleRepository rules,
                                  ContractRepository contracts, PayrunRepository payruns,
                                  RuleEngine ruleEngine, FormulaEngine formulaEngine, AuditService audit) {
        this.structures = structures;
        this.rules = rules;
        this.contracts = contracts;
        this.payruns = payruns;
        this.ruleEngine = ruleEngine;
        this.formulaEngine = formulaEngine;
        this.audit = audit;
    }

    // ------------------------------------------------------------------ structures

    /**
     * Active structures as id and name, for pickers. A projection query, because rules are mapped EAGER
     * and loading entities here would drag every rule of every structure along for a dropdown.
     */
    @PreAuthorize("hasAuthority('salary_structure.list_names')")
    @Transactional(readOnly = true)
    public List<SalaryStructureName> names() {
        return structures.findActiveNames();
    }

    /** Structures by name, searchable over name and code, each with its live headcount. */
    @PreAuthorize("hasAuthority('salary_structure.read')")
    @Transactional(readOnly = true)
    public Page<SalaryStructureDto> list(String q, Boolean active, Pageable pageable) {
        Specification<SalaryStructure> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                ps.add(cb.or(Specs.like(cb, root.get("name"), q), Specs.like(cb, root.get("code"), q)));
            }
            if (active != null) ps.add(cb.equal(root.get("active"), active));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        Page<SalaryStructure> page = structures.findAll(spec, Paging.normalise(pageable, STRUCTURE_DEFAULT, STRUCTURE_SORTS));
        Map<Long, Long> counts = employeeCounts(page.getContent().stream().map(SalaryStructure::getId).toList());
        return page.map(s -> toDto(s, counts.getOrDefault(s.getId(), 0L)));
    }

    @PreAuthorize("hasAuthority('salary_structure.read')")
    @Transactional(readOnly = true)
    public SalaryStructureDto get(Long id) {
        SalaryStructure s = requireStructure(id);
        return toDto(s, employeeCounts(List.of(id)).getOrDefault(id, 0L));
    }

    /** Codes are the stable identifier used in formulas and exports, so they are unique and upper case. */
    @PreAuthorize("hasAuthority('salary_structure.create')")
    @Transactional
    public SalaryStructureDto create(SaveStructure in) {
        if (in.name() == null || in.name().isBlank()) throw ApiException.validation("A structure name is required.");
        if (in.code() == null || in.code().isBlank()) throw ApiException.validation("A structure code is required.");
        String code = in.code().trim().toUpperCase();
        if (structures.existsByCodeIgnoreCase(code)) {
            throw ApiException.conflict("A salary structure with the code " + code + " already exists.");
        }
        SalaryStructure s = new SalaryStructure();
        s.setName(in.name().trim());
        s.setCode(code);
        s.setActive(in.active() == null || in.active());
        s = structures.save(s);
        SalaryStructureDto dto = toDto(s, 0L);
        audit.record(Channel.UI, "CREATE_STRUCTURE", "salary_structure", s.getId().toString(), "ALLOW",
                null, null, audit.toJson(dto));
        return dto;
    }

    /** Partial update: absent fields are left alone, which is how the interface sends a single edit. */
    @PreAuthorize("hasAuthority('salary_structure.update')")
    @Transactional
    public SalaryStructureDto update(Long id, SaveStructure in) {
        SalaryStructure s = requireStructure(id);
        long count = employeeCounts(List.of(id)).getOrDefault(id, 0L);
        String before = audit.toJson(toDto(s, count));
        if (in.name() != null && !in.name().isBlank()) s.setName(in.name().trim());
        if (in.code() != null && !in.code().isBlank()) {
            String code = in.code().trim().toUpperCase();
            if (!code.equalsIgnoreCase(s.getCode()) && structures.existsByCodeIgnoreCase(code)) {
                throw ApiException.conflict("A salary structure with the code " + code + " already exists.");
            }
            s.setCode(code);
        }
        if (in.active() != null) s.setActive(in.active());
        SalaryStructureDto dto = toDto(s, count);
        audit.record(Channel.UI, "UPDATE_STRUCTURE", "salary_structure", id.toString(), "ALLOW",
                null, before, audit.toJson(dto));
        return dto;
    }

    /**
     * Refused while anything still points at the structure. Deleting one that contracts reference would
     * leave those employees unpayable, and one that payruns reference would orphan historical payslips.
     */
    @PreAuthorize("hasAuthority('salary_structure.delete')")
    @Transactional
    public void delete(Long id) {
        SalaryStructure s = requireStructure(id);
        if (contracts.existsBySalaryStructureId(id)) {
            throw ApiException.illegalState(
                    "Contracts still use this structure. Move them to another structure, or deactivate this one instead.");
        }
        if (payruns.existsByStructureId(id)) {
            throw ApiException.illegalState(
                    "Payruns were computed from this structure and must keep it. Deactivate it instead.");
        }
        audit.record(Channel.UI, "DELETE_STRUCTURE", "salary_structure", id.toString(), "ALLOW",
                s.getCode(), audit.toJson(toDto(s, 0L)), null);
        structures.deleteById(id);
    }

    // ------------------------------------------------------------------ rules

    /** Every rule across every structure, in calculation order, for the Salary Rules screen. */
    @PreAuthorize("hasAuthority('salary_rule.read')")
    @Transactional(readOnly = true)
    public Page<SalaryRuleRow> allRules(String q, Long structureId, String category, Boolean active,
                                        Pageable pageable) {
        Specification<SalaryRule> spec = (root, cq, cb) -> {
            var structure = root.join("structure");
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                ps.add(cb.or(Specs.like(cb, root.get("name"), q),
                        Specs.like(cb, root.get("code"), q),
                        Specs.like(cb, structure.get("name"), q)));
            }
            if (structureId != null) ps.add(cb.equal(structure.get("id"), structureId));
            if (category != null && !category.isBlank()) {
                ps.add(cb.equal(root.get("category"), RuleCategory.parse(category).name()));
            }
            if (active != null) ps.add(cb.equal(root.get("active"), active));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return rules.findAll(spec, Paging.normalise(pageable, RULE_DEFAULT, RULE_SORTS)).map(this::toRow);
    }

    /**
     * Adds a rule. Saving the rule directly returns the generated id, which the old parent-cascade
     * approach could not do: the merge produced a detached copy and the id had to be guessed by
     * re-reading the structure and matching on code and sequence.
     */
    @PreAuthorize("hasAuthority('salary_rule.create')")
    @Transactional
    public SalaryRuleDto addRule(Long structureId, SaveRule in) {
        SalaryStructure s = requireStructure(structureId);
        SalaryRule r = new SalaryRule();
        r.setStructure(s);
        applyRule(r, in);
        if (r.getComputeType() == null) throw ApiException.validation("A compute type is required.");
        assertCodeFree(s, r.getCode(), null);
        assertSequenceFree(s, r.getSequence(), null);
        validateRule(r, s.getRules());
        SalaryRule saved = rules.save(r);
        s.getRules().add(saved);
        SalaryRuleDto dto = toRuleDto(saved);
        audit.record(Channel.UI, "ADD_RULE", "salary_structure", structureId.toString(), "ALLOW",
                saved.getCode(), null, audit.toJson(dto));
        return dto;
    }

    /** Updates a rule, validated against its siblings exactly as a new rule would be. */
    @PreAuthorize("hasAuthority('salary_rule.update')")
    @Transactional
    public SalaryRuleDto updateRule(Long structureId, Long ruleId, SaveRule in) {
        SalaryStructure s = requireStructure(structureId);
        SalaryRule r = requireRule(s, ruleId);
        String before = audit.toJson(toRuleDto(r));
        applyRule(r, in);
        assertCodeFree(s, r.getCode(), ruleId);
        assertSequenceFree(s, r.getSequence(), ruleId);
        validateRule(r, siblingsOf(s, ruleId));
        SalaryRuleDto dto = toRuleDto(r);
        audit.record(Channel.UI, "UPDATE_RULE", "salary_structure", structureId.toString(), "ALLOW",
                r.getCode(), before, audit.toJson(dto));
        return dto;
    }

    /** Refused while another rule reads this one, which would leave that rule computing against nothing. */
    @PreAuthorize("hasAuthority('salary_rule.delete')")
    @Transactional
    public void deleteRule(Long structureId, Long ruleId) {
        SalaryStructure s = requireStructure(structureId);
        SalaryRule r = requireRule(s, ruleId);
        assertNoDependents(s, r, "deleted");
        String before = audit.toJson(toRuleDto(r));
        s.getRules().remove(r);
        structures.save(s);
        audit.record(Channel.UI, "DELETE_RULE", "salary_structure", structureId.toString(), "ALLOW",
                r.getCode(), before, null);
    }

    /**
     * Renumbers the rules to 10, 20, 30 in the order given.
     *
     * <p>Two passes: the sequence column is unique per structure and checked per statement, so every rule
     * is first parked on a negative number that cannot collide, then written to its final value.
     * Afterwards every rule is revalidated, because reordering can move a rule in front of the one it reads.
     */
    @PreAuthorize("hasAuthority('salary_rule.update')")
    @Transactional
    public SalaryStructureDto reorderRules(Long structureId, ReorderRules in) {
        SalaryStructure s = requireStructure(structureId);
        List<Long> ordered = in.orderedRuleIds();
        Set<Long> existing = new HashSet<>(s.getRules().stream().map(SalaryRule::getId).toList());
        if (ordered == null || ordered.size() != existing.size() || !existing.containsAll(ordered)
                || new HashSet<>(ordered).size() != ordered.size()) {
            throw ApiException.validation(
                    "The order must list every rule in this structure exactly once (" + existing.size() + " expected).");
        }
        Map<Long, SalaryRule> byId = new HashMap<>();
        s.getRules().forEach(r -> byId.put(r.getId(), r));

        for (int i = 0; i < ordered.size(); i++) byId.get(ordered.get(i)).setSequence(-(i + 1) * 10);
        rules.flush();
        for (int i = 0; i < ordered.size(); i++) byId.get(ordered.get(i)).setSequence((i + 1) * 10);
        rules.flush();

        for (SalaryRule r : s.getRules()) validateRule(r, siblingsOf(s, r.getId()));
        s.getRules().sort(Comparator.comparingInt(SalaryRule::getSequence));
        audit.record(Channel.UI, "REORDER_RULES", "salary_structure", structureId.toString(), "ALLOW",
                ordered.toString(), null, null);
        return toDto(s, employeeCounts(List.of(structureId)).getOrDefault(structureId, 0L));
    }

    /**
     * Switches a rule on or off without deleting it. Payroll skips inactive rules, so switching one off
     * is refused while another active rule still reads its result.
     */
    @PreAuthorize("hasAuthority('salary_rule.update')")
    @Transactional
    public SalaryRuleDto setRuleActive(Long structureId, Long ruleId, boolean active) {
        SalaryStructure s = requireStructure(structureId);
        SalaryRule r = requireRule(s, ruleId);
        if (r.isActive() == active) return toRuleDto(r);
        if (!active) assertNoDependents(s, r, "switched off");
        String before = audit.toJson(toRuleDto(r));
        r.setActive(active);
        SalaryRuleDto dto = toRuleDto(r);
        audit.record(Channel.UI, "SET_RULE_ACTIVE", "salary_structure", structureId.toString(), "ALLOW",
                r.getCode() + " -> " + (active ? "active" : "inactive"), before, audit.toJson(dto));
        return dto;
    }

    /**
     * The variables and functions a formula may use. Gated on read, not on dry run: it is a reference
     * panel, and a payroll user who may read a structure needs it to understand what a rule computes.
     */
    @PreAuthorize("hasAuthority('salary_structure.read')")
    public FormulaHelp formulaHelp() {
        List<FormulaVariable> variables = List.of(
                new FormulaVariable("WAGE", "Contract wage for the period."),
                new FormulaVariable("WORKED_DAYS", "Days actually worked in the period, including paid leave."),
                new FormulaVariable("SCHEDULED_DAYS", "Days the working schedule expects, excluding public holidays."),
                new FormulaVariable("UNPAID_DAYS", "Unpaid leave days deducted from the period."),
                new FormulaVariable("OVERTIME_HOURS", "Overtime hours recorded from attendance."),
                new FormulaVariable("HOURLY_RATE", "Wage divided by the scheduled hours in the period."),
                new FormulaVariable("R_<RULECODE>", "Result of an earlier rule, by its code."),
                new FormulaVariable("C_BASIC", "Running total of the BASIC category."),
                new FormulaVariable("C_ALLOWANCE", "Running total of the ALLOWANCE category."),
                new FormulaVariable("C_DEDUCTION", "Running total of the DEDUCTION category."),
                new FormulaVariable("C_GROSS", "Running total of the GROSS category."),
                new FormulaVariable("C_NET", "Running total of the NET category."),
                new FormulaVariable("I_<INPUTCODE>", "Payrun input value, by its code."));
        return new FormulaHelp(variables, FormulaEngine.FUNCTION_HELP, "C_BASIC * WORKED_DAYS / SCHEDULED_DAYS");
    }

    // ------------------------------------------------------------------ internals

    private SalaryStructure requireStructure(Long id) {
        return structures.findById(id).orElseThrow(() -> ApiException.notFound("structure"));
    }

    private SalaryRule requireRule(SalaryStructure s, Long ruleId) {
        return s.getRules().stream()
                .filter(x -> x.getId().equals(ruleId))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("rule"));
    }

    /** The other rules in the structure, which is what a rule must be validated against. */
    private List<SalaryRule> siblingsOf(SalaryStructure s, Long ruleId) {
        return s.getRules().stream().filter(x -> !x.getId().equals(ruleId)).toList();
    }

    /** Copies the submitted fields onto the rule. Absent scalars are left as they are. */
    private void applyRule(SalaryRule r, SaveRule in) {
        if (in.name() != null) r.setName(in.name().trim());
        if (in.code() != null) r.setCode(in.code().trim().toUpperCase());
        if (in.category() != null) r.setCategory(RuleCategory.parse(in.category()).name());
        if (in.sequence() != null) r.setSequence(in.sequence());
        if (in.computeType() != null) r.setComputeType(in.computeType().trim().toUpperCase());
        // The three computation fields are cleared together: switching a rule from percentage to formula
        // must not leave the old percentage behind to confuse the next reader.
        r.setFixedAmount(in.fixedAmount());
        r.setPercentage(in.percentage());
        r.setBaseRuleCode(in.baseRuleCode());
        r.setFormula(in.formula());
        if (in.active() != null) r.setActive(in.active());
        r.setDescription(in.description());
        if (r.getName() == null || r.getName().isBlank()) throw ApiException.validation("A rule name is required.");
        if (r.getCode() == null || r.getCode().isBlank()) throw ApiException.validation("A rule code is required.");
    }

    /**
     * Checks a rule can actually be computed where it sits.
     *
     * @param others the rest of the structure's rules, never including the rule being validated, so the
     *               add and update paths compare against the same thing.
     */
    void validateRule(SalaryRule r, List<SalaryRule> others) {
        RuleCategory.parse(r.getCategory());
        switch (r.getComputeType()) {
            case "FIXED" -> {
                if (r.getFixedAmount() == null) throw ApiException.validation("A fixed amount is required.");
            }
            case "PERCENTAGE" -> {
                if (r.getPercentage() == null || r.getBaseRuleCode() == null || r.getBaseRuleCode().isBlank()) {
                    throw ApiException.validation("A percentage and a base rule are required.");
                }
                boolean baseIsEarlier = others.stream().anyMatch(
                        x -> x.getCode().equals(r.getBaseRuleCode()) && x.getSequence() < r.getSequence());
                if (!baseIsEarlier) {
                    throw ApiException.validation("The base rule " + r.getBaseRuleCode()
                            + " must exist in this structure and run before sequence " + r.getSequence() + ".");
                }
            }
            case "FORMULA" -> {
                if (r.getFormula() == null || r.getFormula().isBlank()) {
                    throw ApiException.validation("A formula is required.");
                }
                formulaEngine.validate(r.getFormula(), ruleEngine.allowedVariables(others, r));
            }
            default -> throw ApiException.validation(
                    "Unknown compute type: " + r.getComputeType() + ". Allowed: FIXED, PERCENTAGE, FORMULA.");
        }
    }

    /** Refuses a change that would strand another rule reading this one, by percentage base or by R_CODE. */
    private void assertNoDependents(SalaryStructure s, SalaryRule r, String verb) {
        String token = "R_" + r.getCode();
        List<String> dependents = s.getRules().stream()
                .filter(x -> !x.getId().equals(r.getId()) && x.isActive())
                .filter(x -> r.getCode().equals(x.getBaseRuleCode())
                        || (x.getFormula() != null && x.getFormula().contains(token)))
                .map(SalaryRule::getCode)
                .toList();
        if (!dependents.isEmpty()) {
            throw ApiException.illegalState(r.getCode() + " cannot be " + verb
                    + " while these rules read it: " + String.join(", ", dependents) + ".");
        }
    }

    private void assertCodeFree(SalaryStructure s, String code, Long selfId) {
        boolean taken = s.getRules().stream()
                .anyMatch(x -> !x.getId().equals(selfId) && x.getCode().equalsIgnoreCase(code));
        if (taken) throw ApiException.conflict("Another rule in this structure already uses the code " + code + ".");
    }

    private void assertSequenceFree(SalaryStructure s, int sequence, Long selfId) {
        boolean taken = s.getRules().stream()
                .anyMatch(x -> !x.getId().equals(selfId) && x.getSequence() == sequence);
        if (taken) {
            throw ApiException.conflict("Another rule in this structure already runs at sequence " + sequence + ".");
        }
    }

    /** Running contracts per structure, in one grouped query rather than one count per row. */
    private Map<Long, Long> employeeCounts(List<Long> structureIds) {
        Map<Long, Long> counts = new HashMap<>();
        if (structureIds.isEmpty()) return counts;
        for (Object[] row : contracts.countRunningByStructureIds(structureIds)) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        return counts;
    }

    private SalaryStructureDto toDto(SalaryStructure s, long employeeCount) {
        List<SalaryRuleDto> ruleDtos = s.getRules().stream()
                .sorted(Comparator.comparingInt(SalaryRule::getSequence))
                .map(this::toRuleDto)
                .toList();
        return new SalaryStructureDto(s.getId(), s.getName(), s.getCode(), s.isActive(),
                ruleDtos.size(), employeeCount, ruleDtos);
    }

    private SalaryRuleDto toRuleDto(SalaryRule r) {
        return new SalaryRuleDto(r.getId(), r.getStructureId(), r.getName(), r.getCode(), r.getCategory(),
                r.getSequence(), r.getComputeType(), r.getFixedAmount(), r.getPercentage(), r.getBaseRuleCode(),
                r.getFormula(), r.isActive(), r.getDescription());
    }

    private SalaryRuleRow toRow(SalaryRule r) {
        SalaryStructure s = r.getStructure();
        return new SalaryRuleRow(r.getId(), s.getId(), s.getName(), r.getName(), r.getCode(), r.getCategory(),
                r.getSequence(), r.getComputeType(), r.getFixedAmount(), r.getPercentage(), r.getBaseRuleCode(),
                r.getFormula(), r.isActive());
    }
}
