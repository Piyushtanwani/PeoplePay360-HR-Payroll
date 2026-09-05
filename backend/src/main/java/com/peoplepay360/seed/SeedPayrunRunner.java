package com.peoplepay360.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.peoplepay360.contract.Contract;
import com.peoplepay360.contract.ContractResolver;
import com.peoplepay360.employee.Employee;
import com.peoplepay360.employee.EmployeeRepository;
import com.peoplepay360.payroll.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Produces a historical payrun through the real rule engine (not hardcoded values) and marks it paid.
 * Used by the demo seeder for May, June and July 2026 so the dashboard and trends have live data.
 */
@Component
public class SeedPayrunRunner {
    private final PayrunRepository payruns;
    private final PayrunEmployeeRepository payrunEmployees;
    private final PayrunInputRepository inputs;
    private final PayslipRepository payslips;
    private final PayslipLineRepository payslipLines;
    private final PayslipDeliveryRepository deliveries;
    private final SalaryStructureRepository structures;
    private final SalaryStructureVersionRepository versions;
    private final EmployeeRepository employees;
    private final ContractResolver contractResolver;
    private final PayrollInputsBuilder inputsBuilder;
    private final RuleEngine ruleEngine;
    private final ObjectMapper mapper;

    public SeedPayrunRunner(PayrunRepository payruns, PayrunEmployeeRepository payrunEmployees,
                            PayrunInputRepository inputs, PayslipRepository payslips,
                            PayslipLineRepository payslipLines,
                            PayslipDeliveryRepository deliveries, SalaryStructureRepository structures,
                            SalaryStructureVersionRepository versions, EmployeeRepository employees,
                            ContractResolver contractResolver, PayrollInputsBuilder inputsBuilder,
                            RuleEngine ruleEngine, ObjectMapper mapper) {
        this.payruns = payruns;
        this.payrunEmployees = payrunEmployees;
        this.inputs = inputs;
        this.payslips = payslips;
        this.payslipLines = payslipLines;
        this.deliveries = deliveries;
        this.structures = structures;
        this.versions = versions;
        this.employees = employees;
        this.contractResolver = contractResolver;
        this.inputsBuilder = inputsBuilder;
        this.ruleEngine = ruleEngine;
        this.mapper = mapper;
    }

    @Transactional
    public void runHistorical(Long structureId, LocalDate start, LocalDate end, Long adminUserId) {
        SalaryStructure structure = structures.findById(structureId).orElseThrow();
        Payrun p = new Payrun();
        p.setStructureId(structureId);
        p.setPeriodStart(start);
        p.setPeriodEnd(end);
        p.setState("DRAFT");
        p.setCreatedBy(adminUserId);
        String monthName = start.getMonth().getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.ENGLISH);
        p.setName(structure.getName() + " — " + monthName + " " + start.getYear());
        p = payruns.save(p);

        for (Employee e : employees.findAll()) {
            ContractResolver.Resolution res = contractResolver.forPeriod(e.getId(), start, end);
            if (res.contract() == null) continue;
            payrunEmployees.add(p.getId(), e.getId());
            Contract contract = res.contract();

            PayrollInputsBuilder.Inputs computed = inputsBuilder.build(e, contract, start, end);
            Map<String, BigDecimal> effective = new HashMap<>();
            effective.put("SCHEDULED_DAYS", computed.scheduledDays());
            effective.put("WORKED_DAYS", computed.scheduledDays()); // historical: assume full attendance
            effective.put("UNPAID_DAYS", BigDecimal.ZERO);
            effective.put("OVERTIME_HOURS", BigDecimal.ZERO);

            for (Map.Entry<String, BigDecimal> en : effective.entrySet()) {
                PayrunInput pi = new PayrunInput();
                pi.setPayrunId(p.getId());
                pi.setEmployeeId(e.getId());
                pi.setCode(en.getKey());
                pi.setValue(en.getValue());
                pi.setSource("COMPUTED");
                inputs.save(pi);
            }

            Map<String, Double> vars = buildVars(contract, effective);
            RuleEngine.Result result = ruleEngine.compute(structure.getRules(), vars);

            Payslip slip = new Payslip();
            slip.setPayrunId(p.getId());
            slip.setEmployeeId(e.getId());
            slip.setContractId(contract.getId());
            slip.setPeriodStart(start);
            slip.setPeriodEnd(end);
            slip.setScheduledDays(effective.get("SCHEDULED_DAYS"));
            slip.setWorkedDays(effective.get("WORKED_DAYS"));
            slip.setUnpaidDays(BigDecimal.ZERO);
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

            PayslipDelivery d = new PayslipDelivery();
            d.setPayslipId(slip.getId());
            d.setRecipient(e.getWorkEmail());
            d.setStatus("SENT");
            d.setSentAt(OffsetDateTime.now());
            deliveries.save(d);
        }

        SalaryStructureVersion v = new SalaryStructureVersion();
        v.setStructureId(structureId);
        v.setVersionNo((int) versions.countByStructureId(structureId) + 1);
        try { v.setSnapshot(mapper.writeValueAsString(structure.getRules())); }
        catch (Exception ex) { v.setSnapshot("[]"); }
        versions.save(v);

        p.setState("PAID");
        p.setComputedAt(OffsetDateTime.now());
        p.setValidatedBy(adminUserId);
        p.setValidatedAt(OffsetDateTime.now());
        p.setPaidBy(adminUserId);
        p.setPaidAt(OffsetDateTime.now());
        p.setSentAt(OffsetDateTime.now());
        payruns.save(p);
    }

    private Map<String, Double> buildVars(Contract contract, Map<String, BigDecimal> effective) {
        Map<String, Double> vars = new HashMap<>();
        vars.put("WAGE", contract.getWage().doubleValue());
        for (Map.Entry<String, BigDecimal> en : effective.entrySet()) {
            vars.put(en.getKey(), en.getValue().doubleValue());
            vars.put("I_" + en.getKey(), en.getValue().doubleValue());
        }
        double weekly = 37.5;
        double monthlyHours = weekly * 52.0 / 12.0;
        vars.put("HOURLY_RATE", contract.getWage().doubleValue() / monthlyHours);
        return vars;
    }
}
