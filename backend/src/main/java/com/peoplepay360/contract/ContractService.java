package com.peoplepay360.contract;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.contract.ContractDtos.*;
import com.peoplepay360.employee.Employee;
import com.peoplepay360.employee.EmployeeRepository;
import com.peoplepay360.payroll.SalaryStructure;
import com.peoplepay360.payroll.SalaryStructureRepository;
import com.peoplepay360.schedule.WorkingSchedule;
import com.peoplepay360.schedule.WorkingScheduleRepository;
import com.peoplepay360.security.CurrentUser;
import com.peoplepay360.security.OwnershipGuard;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class ContractService {
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

    @PreAuthorize("hasAuthority('contract.read.all')")
    @Transactional(readOnly = true)
    public List<ContractDto> list(Long employeeId, String state, LocalDate endsBefore) {
        Specification<Contract> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (employeeId != null) ps.add(cb.equal(root.get("employeeId"), employeeId));
            if (state != null) ps.add(cb.equal(root.get("state"), state));
            if (endsBefore != null) ps.add(cb.lessThan(root.get("endDate"), endsBefore));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return contracts.findAll(spec).stream().map(c -> toDto(c, true)).toList();
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
            throw new ApiException(ErrorCode.ILLEGAL_STATE, "Only draft or running contracts can be updated.");
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
            throw new ApiException(ErrorCode.ILLEGAL_STATE, "Only a draft contract can be activated.");
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
            throw new ApiException(ErrorCode.ILLEGAL_STATE, "Only draft or running contracts can be cancelled.");
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
            throw new ApiException(ErrorCode.ILLEGAL_STATE, "Only a draft contract can be deleted.");
        }
        contracts.delete(c);
        audit.record(Channel.UI, "DELETE", "contract", id.toString(), "ALLOW", null, null, null);
    }

    public ContractDto toDto(Contract c, boolean full) {
        String empName = employees.findById(c.getEmployeeId()).map(Employee::getDisplayName).orElse(null);
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
