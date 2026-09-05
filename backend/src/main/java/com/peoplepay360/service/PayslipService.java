package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.Paging;
import com.peoplepay360.common.Periods;
import com.peoplepay360.common.Specs;
import com.peoplepay360.dto.PayrollDtos.*;
import com.peoplepay360.model.Contract;
import com.peoplepay360.model.Department;
import com.peoplepay360.model.Employee;
import com.peoplepay360.model.Payrun;
import com.peoplepay360.model.PayrunInput;
import com.peoplepay360.model.Payslip;
import com.peoplepay360.model.PayslipDelivery;
import com.peoplepay360.model.PayslipLine;
import com.peoplepay360.repository.ContractRepository;
import com.peoplepay360.repository.DepartmentRepository;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.repository.PayrunInputRepository;
import com.peoplepay360.repository.PayrunRepository;
import com.peoplepay360.repository.PayslipDeliveryRepository;
import com.peoplepay360.repository.PayslipLineRepository;
import com.peoplepay360.repository.PayslipRepository;
import com.peoplepay360.security.OwnershipGuard;
import com.peoplepay360.security.ScopeResolver;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class PayslipService {
    private static final Map<String, String> SORTS = Map.of(
            "periodStart", "periodStart", "periodEnd", "periodEnd", "net", "net", "gross", "gross",
            "basic", "basic", "deductions", "deductions", "employeeId", "employeeId");
    private static final Sort DEFAULT_SORT =
            Sort.by(Sort.Order.desc("periodStart"), Sort.Order.asc("employeeId"));

    private final PayslipRepository payslips;
    private final PayslipLineRepository payslipLines;
    private final PayslipDeliveryRepository deliveries;
    private final PayrunRepository payruns;
    private final PayrunInputRepository inputs;
    private final EmployeeRepository employees;
    private final DepartmentRepository departments;
    private final ContractRepository contracts;
    private final ScopeResolver scopeResolver;
    private final OwnershipGuard ownershipGuard;

    public PayslipService(PayslipRepository payslips, PayslipLineRepository payslipLines,
                          PayslipDeliveryRepository deliveries, PayrunRepository payruns,
                          PayrunInputRepository inputs, EmployeeRepository employees,
                          DepartmentRepository departments, ContractRepository contracts,
                          ScopeResolver scopeResolver, OwnershipGuard ownershipGuard) {
        this.payslips = payslips;
        this.payslipLines = payslipLines;
        this.deliveries = deliveries;
        this.payruns = payruns;
        this.inputs = inputs;
        this.employees = employees;
        this.departments = departments;
        this.contracts = contracts;
        this.scopeResolver = scopeResolver;
        this.ownershipGuard = ownershipGuard;
    }

    /**
     * Payslips, newest period first. Filters run in SQL, including the period, which the previous
     * implementation accepted and then ignored while loading the whole table.
     */
    @PreAuthorize("hasAuthority('payslip.read.own')")
    @Transactional(readOnly = true)
    public Page<PayslipDto> list(Long payrunId, Long employeeId, String period, String q, Pageable pageable) {
        Long scoped = scopeResolver.resolveEmployeeFilter("payslip.read.all", employeeId);
        LocalDate[] range = period == null || period.isBlank() ? null : Periods.month(period);
        List<Long> matchedEmployeeIds = null;
        if (q != null && !q.isBlank()) {
            matchedEmployeeIds = employees.findIdsMatching("%" + q.toLowerCase() + "%");
            if (matchedEmployeeIds.isEmpty()) return Page.empty(pageable);
        }
        final List<Long> restrictTo = matchedEmployeeIds;

        Specification<Payslip> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (payrunId != null) ps.add(cb.equal(root.get("payrunId"), payrunId));
            if (scoped != null) ps.add(cb.equal(root.get("employeeId"), scoped));
            if (restrictTo != null) ps.add(Specs.in(cb, root.get("employeeId"), restrictTo));
            if (range != null) {
                // A payslip belongs to the month it overlaps.
                ps.add(cb.lessThanOrEqualTo(root.get("periodStart"), range[1]));
                ps.add(cb.greaterThanOrEqualTo(root.get("periodEnd"), range[0]));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
        Page<Payslip> page = payslips.findAll(spec, Paging.normalise(pageable, DEFAULT_SORT, SORTS));
        return page.map(new Enricher(page.getContent())::toDto);
    }

    @PreAuthorize("hasAuthority('payslip.read.all')")
    @Transactional(readOnly = true)
    public DeliveryReport deliveryReport(Long payrunId) {
        List<Payslip> slips = payslips.findByPayrunId(payrunId);
        Enricher enricher = new Enricher(slips);
        List<DeliveryRow> rows = slips.stream()
                .map(enricher::toDto)
                .map(p -> new DeliveryRow(p.id(), p.employeeName(),
                        p.delivery() == null ? "SKIPPED" : p.delivery().status(),
                        p.delivery() == null ? null : p.delivery().sentAt(),
                        p.delivery() == null ? null : p.delivery().recipient()))
                .toList();
        Map<String, Long> summary = new LinkedHashMap<>();
        for (String key : List.of("sent", "queued", "failed", "skipped")) summary.put(key, 0L);
        for (DeliveryRow row : rows) {
            summary.merge(row.status() == null ? "skipped" : row.status().toLowerCase(), 1L, Long::sum);
        }
        return new DeliveryReport(rows, summary);
    }

    @PreAuthorize("hasAuthority('payslip.read.own')")
    @Transactional(readOnly = true)
    public PayslipDto get(Long id) {
        Payslip p = payslips.findById(id).orElseThrow(() -> ApiException.notFound("payslip"));
        ownershipGuard.requireOwnedOr404(p.getEmployeeId(), "payslip.read.all", "payslip", id);
        return new Enricher(List.of(p)).toDto(p);
    }

    @PreAuthorize("hasAuthority('payslip.update.all')")
    @Transactional
    public void setNote(Long id, String note) {
        Payslip p = payslips.findById(id).orElseThrow(() -> ApiException.notFound("payslip"));
        p.setNote(note);
    }

    /**
     * Loads everything a page of payslips needs in a handful of queries.
     *
     * <p>Mapping a payslip touches six other tables. Doing that per row meant a page of twenty payslips
     * issued well over a hundred queries; this batches each lookup once for the whole page.
     */
    private final class Enricher {
        private final Map<Long, Employee> employeeById = new HashMap<>();
        private final Map<Long, String> departmentById = new HashMap<>();
        private final Map<Long, String> contractRefById = new HashMap<>();
        private final Map<Long, Payrun> payrunById = new HashMap<>();
        private final Map<Long, List<PayslipLine>> linesByPayslip = new HashMap<>();
        private final Map<Long, PayslipDelivery> deliveryByPayslip = new HashMap<>();
        private final Map<String, List<PayrunInput>> inputsByPayrunAndEmployee = new HashMap<>();

        private Enricher(List<Payslip> slips) {
            if (slips.isEmpty()) return;
            Set<Long> employeeIds = new HashSet<>();
            Set<Long> payrunIds = new HashSet<>();
            Set<Long> contractIds = new HashSet<>();
            List<Long> payslipIds = new ArrayList<>();
            for (Payslip p : slips) {
                employeeIds.add(p.getEmployeeId());
                payrunIds.add(p.getPayrunId());
                if (p.getContractId() != null) contractIds.add(p.getContractId());
                payslipIds.add(p.getId());
            }
            Set<Long> departmentIds = new HashSet<>();
            employees.findAllById(employeeIds).forEach(e -> {
                employeeById.put(e.getId(), e);
                if (e.getDepartmentId() != null) departmentIds.add(e.getDepartmentId());
            });
            departments.findAllById(departmentIds).forEach(d -> departmentById.put(d.getId(), d.getName()));
            contracts.findAllById(contractIds).forEach(c -> contractRefById.put(c.getId(), c.getReference()));
            payruns.findAllById(payrunIds).forEach(p -> payrunById.put(p.getId(), p));
            payslipLines.findByPayslipIdInOrderBySequenceAsc(payslipIds)
                    .forEach(l -> linesByPayslip.computeIfAbsent(l.getPayslipId(), k -> new ArrayList<>()).add(l));
            deliveries.findByPayslipIdIn(payslipIds)
                    .forEach(d -> deliveryByPayslip.put(d.getPayslipId(), d));
            inputs.findByPayrunIdIn(new ArrayList<>(payrunIds)).forEach(i ->
                    inputsByPayrunAndEmployee
                            .computeIfAbsent(i.getPayrunId() + ":" + i.getEmployeeId(), k -> new ArrayList<>())
                            .add(i));
        }

        private PayslipDto toDto(Payslip p) {
            Employee e = employeeById.get(p.getEmployeeId());
            String departmentName = e == null || e.getDepartmentId() == null
                    ? null : departmentById.get(e.getDepartmentId());
            String contractRef = p.getContractId() == null ? null : contractRefById.get(p.getContractId());
            Payrun payrun = payrunById.get(p.getPayrunId());
            List<PayslipLineDto> lines = linesByPayslip.getOrDefault(p.getId(), List.of()).stream()
                    .map(l -> new PayslipLineDto(l.getRuleCode(), l.getRuleName(), l.getCategory(),
                            l.getSequence(), l.getAmount()))
                    .toList();
            List<PayslipInputDto> inputDtos =
                    inputsByPayrunAndEmployee.getOrDefault(p.getPayrunId() + ":" + p.getEmployeeId(), List.of())
                            .stream()
                            .map(i -> new PayslipInputDto(i.getCode(), i.getValue(), i.getSource()))
                            .toList();
            PayslipDelivery d = deliveryByPayslip.get(p.getId());
            PayStub stub = d != null
                    ? new PayStub(d.getStatus(), d.getSentAt(), d.getRecipient())
                    : new PayStub("NOT_SENT", null, e == null ? null : e.getWorkEmail());
            return new PayslipDto(p.getId(), p.getPayrunId(), payrun == null ? null : payrun.getName(),
                    payrun == null ? null : payrun.getState(), p.getEmployeeId(),
                    e == null ? null : e.getDisplayName(), e == null ? null : e.getEmployeeNo(), departmentName,
                    p.getContractId(), contractRef, p.getPeriodStart(), p.getPeriodEnd(), p.getWorkedDays(),
                    p.getScheduledDays(), p.getUnpaidDays(), p.getBasic(), p.getAllowances(), p.getDeductions(),
                    p.getGross(), p.getNet(), lines, inputDtos, stub);
        }
    }

    /** Used by the PDF renderer, which needs the entity rather than the view. */
    Payslip require(Long id) {
        return payslips.findById(id).orElseThrow(() -> ApiException.notFound("payslip"));
    }

    /** Single-payslip mapping for callers outside a list context. */
    public PayslipDto toDto(Payslip p) {
        return new Enricher(List.of(p)).toDto(p);
    }
}
