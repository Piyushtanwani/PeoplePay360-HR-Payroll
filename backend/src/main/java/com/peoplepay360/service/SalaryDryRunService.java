package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.Money;
import com.peoplepay360.common.Periods;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.dto.PayrollDtos.*;
import com.peoplepay360.model.Contract;
import com.peoplepay360.model.Employee;
import com.peoplepay360.model.Payslip;
import com.peoplepay360.model.SalaryRule;
import com.peoplepay360.model.SalaryStructure;
import com.peoplepay360.repository.ContractRepository;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.repository.PayslipRepository;
import com.peoplepay360.repository.SalaryStructureRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Simulates a salary structure against real employees and real period inputs, and writes nothing.
 *
 * <p>The point is to answer "what would this rule change do to people's pay" before it is saved. It runs
 * the same contract resolution, the same period inputs and the same rule engine as a real payrun, then
 * compares each result against the employee's most recent payslip.
 *
 * <p>Kept out of {@link SalaryStructureService}, which would otherwise need half the payroll repositories
 * to answer a question that never touches a structure's own data.
 */
@Service
public class SalaryDryRunService {
    /** Simulating more than this in one request is a sign the caller wants a payrun, not a preview. */
    private static final int MAX_EMPLOYEES = 200;

    private final SalaryStructureRepository structures;
    private final ContractRepository contracts;
    private final EmployeeRepository employees;
    private final PayslipRepository payslips;
    private final ContractResolver contractResolver;
    private final PayrollInputsBuilder inputsBuilder;
    private final PayrollVarsBuilder varsBuilder;
    private final RuleEngine ruleEngine;
    private final AuditService audit;

    public SalaryDryRunService(SalaryStructureRepository structures, ContractRepository contracts,
                               EmployeeRepository employees, PayslipRepository payslips,
                               ContractResolver contractResolver, PayrollInputsBuilder inputsBuilder,
                               PayrollVarsBuilder varsBuilder, RuleEngine ruleEngine, AuditService audit) {
        this.structures = structures;
        this.contracts = contracts;
        this.employees = employees;
        this.payslips = payslips;
        this.contractResolver = contractResolver;
        this.inputsBuilder = inputsBuilder;
        this.varsBuilder = varsBuilder;
        this.ruleEngine = ruleEngine;
        this.audit = audit;
    }

    @PreAuthorize("hasAuthority('salary_structure.dry_run')")
    @Transactional(readOnly = true)
    public DryRunResult run(Long structureId, DryRunRequest in) {
        SalaryStructure structure = structures.findById(structureId)
                .orElseThrow(() -> ApiException.notFound("structure"));
        LocalDate[] period = Periods.month(in.period());
        List<SalaryRule> rules = structure.getRules();
        if (rules.stream().noneMatch(SalaryRule::isActive)) {
            throw ApiException.validation("This structure has no active rules, so there is nothing to simulate.");
        }

        List<Long> employeeIds = in.employeeIds() == null || in.employeeIds().isEmpty()
                ? contracts.findEmployeeIdsOnStructureInPeriod(structureId, period[0], period[1])
                : in.employeeIds();
        if (employeeIds.isEmpty()) {
            throw ApiException.validation(
                    "No employee holds a running contract on this structure for " + in.period() + ".");
        }
        if (employeeIds.size() > MAX_EMPLOYEES) {
            throw ApiException.validation("A dry run covers at most " + MAX_EMPLOYEES
                    + " employees. Narrow the selection, or create a payrun to process everyone.");
        }

        List<DryRunRow> rows = new ArrayList<>();
        List<Long> negative = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        BigDecimal totalCurrent = Money.zero();
        BigDecimal totalNew = Money.zero();
        BigDecimal totalDelta = Money.zero();

        for (Long employeeId : employeeIds) {
            Employee e = employees.findById(employeeId).orElse(null);
            if (e == null) {
                skipped.add("Employee " + employeeId + " no longer exists.");
                continue;
            }
            ContractResolver.Resolution resolution =
                    contractResolver.forPeriod(employeeId, period[0], period[1]);
            Contract contract = resolution.contract();
            if (contract == null) {
                skipped.add(e.getDisplayName() + " has no contract covering " + in.period() + ".");
                continue;
            }
            if (resolution.warning() != null) warnings.add(e.getDisplayName() + ": " + resolution.warning());

            PayrollInputsBuilder.Inputs computed = inputsBuilder.build(e, contract, period[0], period[1]);
            Map<String, BigDecimal> effective = new LinkedHashMap<>();
            effective.put("SCHEDULED_DAYS", computed.scheduledDays());
            effective.put("WORKED_DAYS", computed.workedDays());
            effective.put("UNPAID_DAYS", computed.unpaidDays());
            effective.put("OVERTIME_HOURS", computed.overtimeHours());

            RuleEngine.Result result =
                    ruleEngine.compute(rules, varsBuilder.build(contract, e, effective));
            result.warnings().forEach(w -> warnings.add(e.getDisplayName() + ": " + w));

            BigDecimal newNet = Money.scale(result.net());
            BigDecimal currentNet = payslips.findTopByEmployeeIdOrderByPeriodEndDesc(employeeId)
                    .map(Payslip::getNet)
                    .orElse(null);
            // No previous payslip means no comparison is possible, so the delta is absent rather than
            // the new figure, which would read as a rise from zero.
            BigDecimal delta = currentNet == null ? null : Money.scale(newNet.subtract(currentNet));
            boolean isNegative = newNet.signum() < 0;
            if (isNegative) negative.add(employeeId);

            totalNew = totalNew.add(newNet);
            if (currentNet != null) {
                totalCurrent = totalCurrent.add(currentNet);
                totalDelta = totalDelta.add(delta);
            }
            rows.add(new DryRunRow(employeeId, e.getDisplayName(), e.getEmployeeNo(),
                    currentNet == null ? null : Money.scale(currentNet), newNet, delta, isNegative,
                    result.lines().stream()
                            .map(l -> new PayslipLineDto(l.code(), l.name(), l.category(), l.sequence(), l.amount()))
                            .toList()));
        }

        if (!negative.isEmpty()) {
            warnings.add(negative.size() + " employee(s) would be paid a negative net amount. "
                    + "Deductions exceed gross pay for them, so this rule set cannot be used as it stands.");
        }
        audit.record(Channel.UI, "DRY_RUN", "salary_structure", structureId.toString(), "ALLOW",
                in.period() + ", " + rows.size() + " employee(s)", null, null);

        DryRunTotals totals = new DryRunTotals(Money.scale(totalCurrent), Money.scale(totalNew),
                Money.scale(totalDelta), rows.size(), negative, warnings, skipped);
        return new DryRunResult(rows, totals);
    }
}
