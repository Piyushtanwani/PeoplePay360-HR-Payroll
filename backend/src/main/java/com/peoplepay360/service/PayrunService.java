package com.peoplepay360.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.common.Money;
import com.peoplepay360.common.Periods;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.model.Contract;
import com.peoplepay360.repository.ContractRepository;
import com.peoplepay360.model.Employee;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.dto.PayrollDtos.*;
import com.peoplepay360.security.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;
import com.peoplepay360.model.Payrun;
import com.peoplepay360.model.PayrunInput;
import com.peoplepay360.model.PayrunIssue;
import com.peoplepay360.model.Payslip;
import com.peoplepay360.model.PayslipDelivery;
import com.peoplepay360.model.PayslipLine;
import com.peoplepay360.model.SalaryStructure;
import com.peoplepay360.model.SalaryStructureVersion;
import com.peoplepay360.repository.PayrunEmployeeRepository;
import com.peoplepay360.repository.PayrunInputRepository;
import com.peoplepay360.repository.PayrunIssueRepository;
import com.peoplepay360.repository.PayrunRepository;
import com.peoplepay360.repository.PayslipDeliveryRepository;
import com.peoplepay360.repository.PayslipLineRepository;
import com.peoplepay360.repository.PayslipRepository;
import com.peoplepay360.repository.SalaryStructureRepository;
import com.peoplepay360.repository.SalaryStructureVersionRepository;

@Service
public class PayrunService {
    private static final Map<String, String> PAYRUN_SORTS = Map.of(
            "periodStart", "periodStart", "periodEnd", "periodEnd", "name", "name", "state", "state",
            "createdAt", "createdAt", "paidAt", "paidAt");
    /** Newest period first: the run people want is almost always the most recent one. */
    private static final org.springframework.data.domain.Sort PAYRUN_DEFAULT_SORT =
            org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Order.desc("periodStart"),
                    org.springframework.data.domain.Sort.Order.desc("id"));

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(PayrunService.class);

    private final PayrunRepository payruns;
    private final PayrunEmployeeRepository payrunEmployees;
    private final PayrunInputRepository inputs;
    private final PayrunIssueRepository issues;
    private final PayslipRepository payslips;
    private final PayslipLineRepository payslipLines;
    private final PayslipDeliveryRepository deliveries;
    private final SalaryStructureRepository structures;
    private final SalaryStructureVersionRepository versions;
    private final EmployeeRepository employees;
    private final ContractRepository contracts;
    private final ContractResolver contractResolver;
    private final PayrollInputsBuilder inputsBuilder;
    private final PayrollVarsBuilder varsBuilder;
    private final RuleEngine ruleEngine;
    private final PayrunChecker checker;
    private final PayslipMailService mailService;
    private final CurrentUser currentUser;
    private final AuditService audit;
    private final ObjectMapper mapper;

    public PayrunService(PayrunRepository payruns, PayrunEmployeeRepository payrunEmployees,
                         PayrunInputRepository inputs, PayrunIssueRepository issues, PayslipRepository payslips,
                         PayslipLineRepository payslipLines,
                         PayslipDeliveryRepository deliveries, SalaryStructureRepository structures,
                         SalaryStructureVersionRepository versions, EmployeeRepository employees,
                         ContractRepository contracts, ContractResolver contractResolver,
                         PayrollInputsBuilder inputsBuilder, PayrollVarsBuilder varsBuilder,
                         RuleEngine ruleEngine, PayrunChecker checker, PayslipMailService mailService,
                         CurrentUser currentUser, AuditService audit, ObjectMapper mapper) {
        this.payruns = payruns;
        this.payrunEmployees = payrunEmployees;
        this.inputs = inputs;
        this.issues = issues;
        this.payslips = payslips;
        this.payslipLines = payslipLines;
        this.deliveries = deliveries;
        this.structures = structures;
        this.versions = versions;
        this.employees = employees;
        this.contracts = contracts;
        this.contractResolver = contractResolver;
        this.varsBuilder = varsBuilder;
        this.inputsBuilder = inputsBuilder;
        this.ruleEngine = ruleEngine;
        this.checker = checker;
        this.mailService = mailService;
        this.currentUser = currentUser;
        this.audit = audit;
        this.mapper = mapper;
    }

    // ---------- wizard ----------
    @PreAuthorize("hasAuthority('payrun.create')")
    @Transactional(readOnly = true)
    public List<EligibleEmployee> eligibility(EligibilityRequest in) {
        SalaryStructure structure = structures.findById(in.structureId())
                .orElseThrow(() -> ApiException.validation("Unknown structure"));
        List<EligibleEmployee> out = new ArrayList<>();
        for (Employee e : employees.findAll()) {
            if (!e.isActive()) {
                out.add(ineligible(e, "Employee is inactive"));
                continue;
            }
            ContractResolver.Resolution res = contractResolver.forPeriod(e.getId(), in.periodStart(), in.periodEnd());
            if (res.contract() == null) {
                List<Contract> drafts = contracts.findByEmployeeIdAndStateIn(e.getId(), List.of("DRAFT"));
                String reason = drafts.isEmpty() ? "No contract valid in period" : "Only a draft contract exists";
                out.add(ineligible(e, reason));
                continue;
            }
            Contract c = res.contract();
            String structName = c.getSalaryStructureId() == null ? null :
                    structures.findById(c.getSalaryStructureId()).map(SalaryStructure::getName).orElse(null);
            boolean already = payslips.findOverlapping(e.getId(), in.periodStart(), in.periodEnd()).stream()
                    .anyMatch(p -> !"CANCELLED".equals(stateOf(p.getPayrunId())));
            if (already) {
                out.add(ineligible(e, "Already on a payrun for an overlapping period"));
                continue;
            }
            out.add(new EligibleEmployee(e.getId(), e.getEmployeeNo(), e.getDisplayName(),
                    null, c.getReference(), structName, true, null));
        }
        return out;
    }

    @PreAuthorize("hasAuthority('payrun.create')")
    @Transactional
    public PayrunDto create(CreatePayrun in) {
        SalaryStructure structure = structures.findById(in.structureId())
                .orElseThrow(() -> ApiException.validation("Unknown structure"));
        Payrun p = new Payrun();
        p.setStructureId(in.structureId());
        p.setPeriodStart(in.periodStart());
        p.setPeriodEnd(in.periodEnd());
        p.setState("DRAFT");
        p.setCreatedBy(currentUser.userId());
        String monthName = in.periodStart().getMonth().getDisplayName(java.time.format.TextStyle.FULL, Locale.ENGLISH);
        p.setName(in.name() != null && !in.name().isBlank() ? in.name()
                : structure.getName() + " — " + monthName + " " + in.periodStart().getYear());
        p = payruns.save(p);
        for (Long empId : in.employeeIds()) payrunEmployees.add(p.getId(), empId);
        audit.record(Channel.UI, "CREATE_PAYRUN", "payrun", p.getId().toString(), "ALLOW", null, null, null);
        return toDto(p);
    }

    @PreAuthorize("hasAuthority('payrun.read')")
    @Transactional(readOnly = true)
    public PayrunDto get(Long id) { return toDto(require(id)); }

    /** Payruns, most recent period first, searchable by name. Filters run in SQL, not over the whole table. */
    @PreAuthorize("hasAuthority('payrun.read')")
    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<PayrunDto> list(
            String state, String period, String q, org.springframework.data.domain.Pageable pageable) {
        LocalDate[] range = period == null || period.isBlank() ? null : Periods.month(period);
        org.springframework.data.jpa.domain.Specification<Payrun> spec = (root, cq, cb) -> {
            List<jakarta.persistence.criteria.Predicate> ps = new ArrayList<>();
            if (state != null && !state.isBlank()) ps.add(cb.equal(root.get("state"), state));
            if (range != null) {
                ps.add(cb.lessThanOrEqualTo(root.get("periodStart"), range[1]));
                ps.add(cb.greaterThanOrEqualTo(root.get("periodEnd"), range[0]));
            }
            if (q != null && !q.isBlank()) ps.add(com.peoplepay360.common.Specs.like(cb, root.get("name"), q));
            return cb.and(ps.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
        return payruns.findAll(spec, com.peoplepay360.common.Paging.normalise(pageable, PAYRUN_DEFAULT_SORT, PAYRUN_SORTS))
                .map(this::toDto);
    }

    @PreAuthorize("hasAuthority('payrun.update')")
    @Transactional
    public PayrunDto update(Long id, UpdatePayrun in) {
        Payrun p = require(id);
        if (in.name() != null) p.setName(in.name());
        if (in.employeeIds() != null) {
            if (!"DRAFT".equals(p.getState())) {
                throw ApiException.illegalState("Employees can only be changed while the payrun is draft.");
            }
            payrunEmployees.clear(id);
            for (Long empId : in.employeeIds()) payrunEmployees.add(id, empId);
        }
        return toDto(p);
    }

    // ---------- compute ----------
    @PreAuthorize("hasAuthority('payrun.compute')")
    @Transactional
    public PayrunDto compute(Long id) {
        Payrun p = require(id);
        if (!List.of("DRAFT", "COMPUTED").contains(p.getState())) {
            throw ApiException.illegalState("Only a draft or computed payrun can be computed.");
        }
        // preserve overridden issues
        Map<String, String> overridden = new HashMap<>();
        for (PayrunIssue i : issues.findByPayrunId(id)) {
            if ("OVERRIDDEN".equals(i.getStatus())) {
                overridden.put(i.getCheckCode() + ":" + i.getEmployeeId(), i.getOverrideReason());
            }
        }
        payslips.deleteByPayrunId(id);
        issues.deleteByPayrunId(id);
        inputs.deleteByPayrunIdAndSource(id, "COMPUTED");

        SalaryStructure structure = structures.findById(p.getStructureId())
                .orElseThrow(() -> ApiException.validation("Unknown structure"));
        List<Long> employeeIds = payrunEmployees.employeeIds(id);

        for (Long empId : employeeIds) {
            Employee e = employees.findById(empId).orElse(null);
            if (e == null) continue;
            ContractResolver.Resolution res = contractResolver.forPeriod(empId, p.getPeriodStart(), p.getPeriodEnd());
            if (res.contract() == null) continue; // NO_VALID_CONTRACT surfaced by checker; no payslip
            Contract contract = res.contract();

            PayrollInputsBuilder.Inputs computed = inputsBuilder.build(e, contract, p.getPeriodStart(), p.getPeriodEnd());
            Map<String, BigDecimal> effective = new LinkedHashMap<>();
            effective.put("SCHEDULED_DAYS", computed.scheduledDays());
            effective.put("WORKED_DAYS", computed.workedDays());
            effective.put("UNPAID_DAYS", computed.unpaidDays());
            effective.put("OVERTIME_HOURS", computed.overtimeHours());

            // manual overrides + extra inputs
            List<PayrunInput> manual = inputs.findByPayrunIdAndEmployeeId(id, empId).stream()
                    .filter(pi -> "MANUAL".equals(pi.getSource())).toList();
            for (PayrunInput m : manual) effective.put(m.getCode(), m.getValue());

            // persist computed inputs
            for (Map.Entry<String, BigDecimal> en : effective.entrySet()) {
                if (manual.stream().anyMatch(m -> m.getCode().equals(en.getKey()))) continue;
                PayrunInput pi = new PayrunInput();
                pi.setPayrunId(id);
                pi.setEmployeeId(empId);
                pi.setCode(en.getKey());
                pi.setValue(en.getValue());
                pi.setSource("COMPUTED");
                inputs.save(pi);
            }

            Map<String, Double> vars = varsBuilder.build(contract, e, effective);
            RuleEngine.Result result = ruleEngine.compute(structure.getRules(), vars);

            Payslip slip = new Payslip();
            slip.setPayrunId(id);
            slip.setEmployeeId(empId);
            slip.setContractId(contract.getId());
            slip.setPeriodStart(p.getPeriodStart());
            slip.setPeriodEnd(p.getPeriodEnd());
            slip.setScheduledDays(effective.get("SCHEDULED_DAYS"));
            slip.setWorkedDays(effective.get("WORKED_DAYS"));
            slip.setUnpaidDays(effective.get("UNPAID_DAYS"));
            slip.setBasic(result.basic());
            slip.setAllowances(result.allowances());
            slip.setDeductions(result.deductions());
            slip.setGross(result.gross());
            slip.setNet(result.net());
            slip = payslips.save(slip);
            for (RuleEngine.Line l : result.lines()) {
                PayslipLine pl = new PayslipLine();
                pl.setPayslipId(slip.getId());
                pl.setRuleId(l.ruleId());
                pl.setRuleCode(l.code());
                pl.setRuleName(l.name());
                pl.setCategory(l.category());
                pl.setSequence(l.sequence());
                pl.setAmount(l.amount());
                payslipLines.save(pl);
            }

            // assert totals consistency
            assertTotals(result);

            PayslipDelivery d = new PayslipDelivery();
            d.setPayslipId(slip.getId());
            d.setRecipient(e.getWorkEmail());
            d.setStatus("NOT_SENT");
            deliveries.save(d);
        }

        // snapshot structure version
        SalaryStructureVersion v = new SalaryStructureVersion();
        v.setStructureId(structure.getId());
        v.setVersionNo((int) versions.countByStructureId(structure.getId()) + 1);
        // The snapshot is what explains an old payslip after the rules move on, so a failure to write
        // it is worth knowing about even though it must not fail the payrun.
        try {
            v.setSnapshot(mapper.writeValueAsString(structure.getRules()));
        } catch (Exception ex) {
            log.warn("Could not snapshot structure {} for payrun {}: {}",
                    structure.getId(), p.getId(), ex.getMessage());
            v.setSnapshot("[]");
        }
        versions.save(v);

        // checks
        for (PayrunIssue i : checker.check(p, employeeIds)) {
            String key = i.getCheckCode() + ":" + i.getEmployeeId();
            if (overridden.containsKey(key) && i.isOverridable()) {
                i.setStatus("OVERRIDDEN");
                i.setOverrideReason(overridden.get(key));
            }
            issues.save(i);
        }

        p.setState("COMPUTED");
        p.setComputedAt(OffsetDateTime.now());
        audit.record(Channel.UI, "COMPUTE_PAYRUN", "payrun", id.toString(), "ALLOW", null, null, null);
        return toDto(p);
    }

    // ---------- issues ----------
    @PreAuthorize("hasAuthority('payrun.read')")
    @Transactional(readOnly = true)
    public List<PayrunIssueDto> issues(Long payrunId, String severity, String status) {
        List<PayrunIssue> rows = status == null || status.isBlank()
                ? issues.findByPayrunId(payrunId)
                : issues.findByPayrunIdAndStatus(payrunId, status);
        return rows.stream()
                .filter(i -> severity == null || i.getSeverity().equals(severity))
                .filter(i -> status == null || i.getStatus().equals(status))
                .map(this::toIssueDto).toList();
    }

    @PreAuthorize("hasAuthority('payrun.override_issue')")
    @Transactional
    public void overrideIssue(Long payrunId, Long issueId, OverrideRequest in) {
        PayrunIssue i = issues.findById(issueId).orElseThrow(() -> ApiException.notFound("issue"));
        if (!i.isOverridable()) {
            throw new ApiException(ErrorCode.NOT_OVERRIDABLE, "This issue cannot be overridden.");
        }
        if (in == null || in.reason() == null || in.reason().isBlank()) {
            throw ApiException.validation("An override reason is required.");
        }
        i.setStatus("OVERRIDDEN");
        i.setOverrideReason(in.reason());
        i.setResolvedBy(currentUser.userId());
        audit.record(Channel.UI, "OVERRIDE_ISSUE", "payrun", payrunId.toString(), "ALLOW", in.reason(), null, null);
    }

    // ---------- state transitions ----------
    @PreAuthorize("hasAuthority('payrun.validate')")
    @Transactional
    public PayrunDto validate(Long id) {
        Payrun p = require(id);
        if (!"COMPUTED".equals(p.getState())) {
            throw ApiException.illegalState("Only a computed payrun can be validated.");
        }
        List<PayrunIssue> blockers = issues.findByPayrunIdAndSeverityAndStatus(id, "BLOCKER", "OPEN");
        if (!blockers.isEmpty()) {
            throw new ApiException(ErrorCode.BLOCKERS_PRESENT,
                    "Resolve or override " + blockers.size() + " blocker(s) before validating.");
        }
        p.setState("VALIDATED");
        p.setValidatedBy(currentUser.userId());
        p.setValidatedAt(OffsetDateTime.now());
        audit.record(Channel.UI, "VALIDATE_PAYRUN", "payrun", id.toString(), "ALLOW", null, null, null);
        return toDto(p);
    }

    @PreAuthorize("hasAuthority('payrun.pay')")
    @Transactional
    public PayrunDto pay(Long id, PayRequest in) {
        Payrun p = require(id);
        if (!"VALIDATED".equals(p.getState())) {
            throw ApiException.illegalState("Only a validated payrun can be marked paid.");
        }
        p.setState("PAID");
        p.setPaidBy(currentUser.userId());
        p.setPaidAt(OffsetDateTime.now());
        audit.record(Channel.UI, "PAY_PAYRUN", "payrun", id.toString(), "ALLOW",
                in == null ? null : in.note(), null, null);
        return toDto(p);
    }

    @PreAuthorize("hasAuthority('payrun.send')")
    @Transactional
    public SendResult send(Long id) {
        Payrun p = require(id);
        if (!List.of("PAID", "SENT").contains(p.getState())) {
            throw ApiException.illegalState("Only a paid payrun can send payslips.");
        }
        List<Payslip> slips = payslips.findByPayrunId(id);
        int queued = 0, skipped = 0;
        for (Payslip s : slips) {
            Employee e = employees.findById(s.getEmployeeId()).orElse(null);
            if (e == null || e.getWorkEmail() == null || e.getWorkEmail().isBlank()) skipped++; else queued++;
        }
        mailService.sendAll(id);
        audit.record(Channel.UI, "SEND_PAYSLIPS", "payrun", id.toString(), "ALLOW", null, null, null);
        return new SendResult(queued, skipped);
    }

    @PreAuthorize("hasAuthority('payrun.delete')")
    @Transactional
    public void cancel(Long id) {
        Payrun p = require(id);
        if (!List.of("DRAFT", "COMPUTED").contains(p.getState())) {
            throw ApiException.illegalState("Only a draft or computed payrun can be cancelled.");
        }
        payslips.deleteByPayrunId(id);
        p.setState("CANCELLED");
        audit.record(Channel.UI, "CANCEL_PAYRUN", "payrun", id.toString(), "ALLOW", null, null, null);
    }

    @PreAuthorize("hasAuthority('payrun.update')")
    @Transactional
    public void addInput(Long id, PayInput in) {
        Payrun p = require(id);
        if (!List.of("DRAFT", "COMPUTED").contains(p.getState())) {
            throw ApiException.illegalState("Inputs can only be added before validation.");
        }
        PayrunInput pi = inputs.findByPayrunIdAndEmployeeId(id, in.employeeId()).stream()
                .filter(x -> x.getCode().equals(in.code()) && "MANUAL".equals(x.getSource()))
                .findFirst().orElseGet(PayrunInput::new);
        pi.setPayrunId(id);
        pi.setEmployeeId(in.employeeId());
        pi.setCode(in.code());
        pi.setValue(in.value());
        pi.setSource("MANUAL");
        inputs.save(pi);
    }

    // ---------- helpers ----------
    /**
     * Guards the one invariant every payslip must satisfy: net equals gross minus deductions.
     * Gross itself is deliberately not asserted against basic plus allowances, because a structure
     * is allowed an explicit GROSS rule that computes something else.
     */
    private void assertTotals(RuleEngine.Result r) {
        BigDecimal expectedNet = Money.scale(r.gross().subtract(r.deductions()));
        if (r.net().compareTo(expectedNet) != 0) {
            throw ApiException.illegalState(
                    "Payslip totals are inconsistent: net " + r.net() + " != gross - deductions " + expectedNet);
        }
    }
    private String stateOf(Long payrunId) {
        return payruns.findById(payrunId).map(Payrun::getState).orElse("CANCELLED");
    }
    private EligibleEmployee ineligible(Employee e, String reason) {
        return new EligibleEmployee(e.getId(), e.getEmployeeNo(), e.getDisplayName(), null, null, null, false, reason);
    }
    public Payrun require(Long id) {
        return payruns.findById(id).orElseThrow(() -> ApiException.notFound("payrun"));
    }
    public PayrunDto toDto(Payrun p) {
        String structName = structures.findById(p.getStructureId()).map(SalaryStructure::getName).orElse(null);
        List<Payslip> slips = payslips.findByPayrunId(p.getId());
        BigDecimal totalNet = slips.stream().map(Payslip::getNet).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalGross = slips.stream().map(Payslip::getGross).reduce(BigDecimal.ZERO, BigDecimal::add);
        long blockers = issues.findByPayrunIdAndSeverityAndStatus(p.getId(), "BLOCKER", "OPEN").size();
        long warnings = issues.findByPayrunId(p.getId()).stream()
                .filter(i -> "WARNING".equals(i.getSeverity()) && "OPEN".equals(i.getStatus())).count();
        int empCount = payrunEmployees.employeeIds(p.getId()).size();
        return new PayrunDto(p.getId(), p.getName(), p.getStructureId(), structName, p.getPeriodStart(),
                p.getPeriodEnd(), p.getState(), empCount, slips.size(), Money.scale(totalNet), Money.scale(totalGross),
                blockers, warnings, p.getCreatedBy(), p.getCreatedAt(), p.getComputedAt(), p.getValidatedAt(),
                p.getPaidAt(), p.getSentAt());
    }
    private PayrunIssueDto toIssueDto(PayrunIssue i) {
        String name = i.getEmployeeId() == null ? null :
                employees.findById(i.getEmployeeId()).map(Employee::getDisplayName).orElse(null);
        return new PayrunIssueDto(i.getId(), i.getPayrunId(), i.getEmployeeId(), name, i.getCheckCode(),
                i.getSeverity(), i.isOverridable(), i.getMessage(), i.getStatus(), i.getOverrideReason(), i.getFixLink());
    }
}
