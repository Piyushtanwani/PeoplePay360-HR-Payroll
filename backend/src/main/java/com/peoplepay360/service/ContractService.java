package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.dto.ContractDtos.*;
import com.peoplepay360.model.Employee;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.model.SalaryStructure;
import com.peoplepay360.repository.SalaryStructureRepository;
import com.peoplepay360.model.WorkingSchedule;
import com.peoplepay360.repository.WorkingScheduleRepository;
import com.peoplepay360.security.CurrentUser;
import com.peoplepay360.security.OwnershipGuard;
import com.peoplepay360.common.Paging;
import com.peoplepay360.common.Specs;
import com.peoplepay360.model.ContractTemplate;
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
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import com.peoplepay360.model.Contract;
import com.peoplepay360.repository.ContractRepository;

@Service
public class ContractService {
    private static final Map<String, String> SORTS = Map.of(
            "reference", "reference", "startDate", "startDate", "endDate", "endDate",
            "wage", "wage", "state", "state", "jobTitle", "jobTitle", "employeeId", "employeeId");
    private static final Sort DEFAULT_SORT =
            Sort.by(Sort.Order.desc("startDate"), Sort.Order.desc("id"));

    private final ContractRepository contracts;
    private final EmployeeRepository employees;
    private final WorkingScheduleRepository schedules;
    private final SalaryStructureRepository structures;
    private final CurrentUser currentUser;
    private final OwnershipGuard ownershipGuard;
    private final AuditService audit;

    public ContractService(ContractRepository contracts, EmployeeRepository employees,
                           WorkingScheduleRepository schedules, SalaryStructureRepository structures,
                           CurrentUser currentUser, OwnershipGuard ownershipGuard, AuditService audit) {
        this.contracts = contracts;
        this.employees = employees;
        this.schedules = schedules;
        this.structures = structures;
        this.currentUser = currentUser;
        this.ownershipGuard = ownershipGuard;
        this.audit = audit;
    }

    /**
     * Contracts, most recently started first, searchable by reference, job title or the employee's name.
     *
     * <p>EXPIRED is a derived state, not a stored one, so filtering on it means running contracts whose
     * end date has passed rather than a column comparison.
     */
    @PreAuthorize("hasAnyAuthority('contract.read.all', 'contract.read.own')")
    @Transactional(readOnly = true)
    public Page<ContractDto> list(Long employeeId, String state, LocalDate endsBefore, String q, Pageable pageable) {
        boolean full = currentUser.hasAuthority("contract.read.all");
        if (!full) {
            Long ownEmpId = currentUser.employeeId();
            if (ownEmpId == null) return Page.empty(pageable);
            employeeId = ownEmpId;
        }

        List<Long> matchedEmployees = null;
        if (q != null && !q.isBlank()) {
            matchedEmployees = employees.findIdsMatching("%" + q.toLowerCase() + "%");
        }
        final List<Long> byName = matchedEmployees;
        LocalDate today = LocalDate.now();

        final Long targetEmployeeId = employeeId;
        Specification<Contract> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (targetEmployeeId != null) ps.add(cb.equal(root.get("employeeId"), targetEmployeeId));
            if (state != null && !state.isBlank()) {
                if ("EXPIRED".equals(state)) {
                    ps.add(cb.equal(root.get("state"), "RUNNING"));
                    ps.add(cb.lessThan(root.get("endDate"), today));
                } else if ("RUNNING".equals(state)) {
                    ps.add(cb.equal(root.get("state"), "RUNNING"));
                    ps.add(cb.or(cb.isNull(root.get("endDate")),
                            cb.greaterThanOrEqualTo(root.get("endDate"), today)));
                } else {
                    ps.add(cb.equal(root.get("state"), state));
                }
            }
            if (endsBefore != null) ps.add(cb.lessThan(root.get("endDate"), endsBefore));
            if (q != null && !q.isBlank()) {
                ps.add(cb.or(Specs.like(cb, root.get("reference"), q),
                        Specs.like(cb, root.get("jobTitle"), q),
                        Specs.in(cb, root.get("employeeId"), byName)));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
        Page<Contract> page = contracts.findAll(spec, Paging.normalise(pageable, DEFAULT_SORT, SORTS));
        Map<Long, Employee> employeeById = new HashMap<>();
        employees.findAllById(page.getContent().stream().map(Contract::getEmployeeId).collect(Collectors.toSet()))
                .forEach(e -> employeeById.put(e.getId(), e));
        return page.map(c -> toDto(c, full, employeeById.get(c.getEmployeeId())));
    }

    @PreAuthorize("hasAuthority('contract.read.own')")
    @Transactional(readOnly = true)
    public ContractDto get(Long id) {
        Contract c = contracts.findById(id).orElseThrow(() -> ApiException.notFound("contract"));
        ownershipGuard.requireOwnedOr404(c.getEmployeeId(), "contract.read.all", "contract", id);
        boolean full = currentUser.hasAuthority("contract.read.all");
        return toDto(c, full);
    }

    @PreAuthorize("hasAuthority('contract.create.all')")
    @Transactional
    public ContractDto create(CreateContract in) {
        Contract c = new Contract();
        c.setReference(nextReference());
        c.setEmployeeId(in.employeeId());
        c.setWage(in.wage());
        c.setWageType(in.wageType() == null ? "MONTHLY" : in.wageType());
        c.setStartDate(in.startDate());
        c.setEndDate(in.endDate());
        c.setState("DRAFT");
        c.setWorkingScheduleId(in.workingScheduleId());
        c.setSalaryStructureId(in.salaryStructureId());
        c.setJobTitle(in.jobTitle());
        c.setDepartmentId(in.departmentId());
        c = contracts.save(c);
        audit.record(Channel.UI, "CREATE", "contract", c.getId().toString(), "ALLOW", null, null, audit.toJson(in));
        return toDto(c, true);
    }

    @PreAuthorize("hasAuthority('contract.update.all')")
    @Transactional
    public ContractDto update(Long id, UpdateContract in) {
        Contract c = contracts.findById(id).orElseThrow(() -> ApiException.notFound("contract"));
        if (!List.of("DRAFT", "RUNNING").contains(c.getState())) {
            throw ApiException.illegalState("Only draft or running contracts can be updated.");
        }
        if (in.wage() != null) c.setWage(in.wage());
        if (in.wageType() != null) c.setWageType(in.wageType());
        if (in.startDate() != null) c.setStartDate(in.startDate());
        if (in.endDate() != null) c.setEndDate(in.endDate());
        if (in.workingScheduleId() != null) c.setWorkingScheduleId(in.workingScheduleId());
        if (in.salaryStructureId() != null) c.setSalaryStructureId(in.salaryStructureId());
        if (in.jobTitle() != null) c.setJobTitle(in.jobTitle());
        if (in.departmentId() != null) c.setDepartmentId(in.departmentId());
        audit.record(Channel.UI, "UPDATE", "contract", id.toString(), "ALLOW", null, null, audit.toJson(in));
        return toDto(c, true);
    }

    @PreAuthorize("hasAuthority('contract.activate')")
    @Transactional
    public ContractDto activate(Long id) {
        Contract c = contracts.findById(id).orElseThrow(() -> ApiException.notFound("contract"));
        if (!"DRAFT".equals(c.getState())) {
            throw ApiException.illegalState("Only a draft contract can be activated.");
        }
        c.setState("RUNNING");
        audit.record(Channel.UI, "ACTIVATE", "contract", id.toString(), "ALLOW", null, null, null);
        return toDto(c, true);
    }

    @PreAuthorize("hasAuthority('contract.update.all')")
    @Transactional
    public ContractDto cancel(Long id) {
        Contract c = contracts.findById(id).orElseThrow(() -> ApiException.notFound("contract"));
        if (!List.of("DRAFT", "RUNNING").contains(c.getState())) {
            throw ApiException.illegalState("Only draft or running contracts can be cancelled.");
        }
        c.setState("CANCELLED");
        audit.record(Channel.UI, "CANCEL", "contract", id.toString(), "ALLOW", null, null, null);
        return toDto(c, true);
    }

    @PreAuthorize("hasAuthority('contract.delete.all')")
    @Transactional
    public void delete(Long id) {
        Contract c = contracts.findById(id).orElseThrow(() -> ApiException.notFound("contract"));
        if (!"DRAFT".equals(c.getState())) {
            throw ApiException.illegalState("Only a draft contract can be deleted.");
        }
        contracts.delete(c);
        audit.record(Channel.UI, "DELETE", "contract", id.toString(), "ALLOW", null, null, null);
    }

    public ContractDto toDto(Contract c, boolean full) {
        return toDto(c, full, employees.findById(c.getEmployeeId()).orElse(null));
    }

    /** Overload used when listing, where the employees for the page were already loaded in one query. */
    public ContractDto toDto(Contract c, boolean full, Employee employee) {
        String empName = employee == null ? null : employee.getDisplayName();
        String schedName = c.getWorkingScheduleId() == null ? null :
                schedules.findById(c.getWorkingScheduleId()).map(WorkingSchedule::getName).orElse(null);
        String structName = c.getSalaryStructureId() == null ? null :
                structures.findById(c.getSalaryStructureId()).map(SalaryStructure::getName).orElse(null);
        boolean activeNow = "RUNNING".equals(c.getState()) && c.containsDate(LocalDate.now());
        String derived = c.derivedState(LocalDate.now());
        if (full) {
            return new ContractDto(c.getId(), c.getEmployeeId(), empName, c.getReference(), c.getWage(),
                    c.getWageType(), c.getStartDate(), c.getEndDate(), derived, c.getWorkingScheduleId(),
                    schedName, c.getSalaryStructureId(), structName, c.getJobTitle(), c.getDepartmentId(),
                    activeNow, c.getVersion());
        }
        // .own projection omits wage, wage type and salary structure
        return new ContractDto(c.getId(), c.getEmployeeId(), empName, c.getReference(), null, null,
                c.getStartDate(), c.getEndDate(), derived, c.getWorkingScheduleId(), schedName,
                null, null, c.getJobTitle(), c.getDepartmentId(), activeNow, c.getVersion());
    }

    /**
     * Creates an already-running contract from a template, for the employee onboarding flow.
     *
     * <p>Intentionally not permission annotated: it is only reachable from
     * {@code EmployeeService.create}, which checks contract.create.all and contract.activate itself
     * before calling. A self-invoked annotated method would not be checked at all, so the check is
     * made explicit at the caller rather than implied here.
     */
    @Transactional
    Contract createRunningFromTemplate(Employee employee, ContractTemplate template,
                                       java.math.BigDecimal wageOverride, LocalDate startDate) {
        Contract c = new Contract();
        c.setReference(nextReference());
        c.setEmployeeId(employee.getId());
        c.setWage(wageOverride != null ? wageOverride : template.getWage());
        c.setWageType(template.getWageType());
        c.setStartDate(startDate);
        c.setState("RUNNING");
        // The template's schedule and structure win; anything it leaves blank falls back to the employee.
        c.setWorkingScheduleId(template.getWorkingScheduleId() != null
                ? template.getWorkingScheduleId() : employee.getWorkingScheduleId());
        c.setSalaryStructureId(template.getSalaryStructureId());
        c.setJobTitle(template.getJobTitle() != null ? template.getJobTitle() : employee.getJobTitle());
        c.setDepartmentId(employee.getDepartmentId());
        c = contracts.save(c);
        audit.record(Channel.UI, "CREATE_FROM_TEMPLATE", "contract", c.getId().toString(), "ALLOW",
                "template: " + template.getName(), null, null);
        return c;
    }

    private String nextReference() {
        long n = contracts.count();
        String ref;
        do { n++; ref = String.format("C-%04d", n); } while (contracts.findAll(refSpec(ref)).size() > 0);
        return ref;
    }
    private Specification<Contract> refSpec(String ref) {
        return (root, cq, cb) -> cb.equal(root.get("reference"), ref);
    }
}
