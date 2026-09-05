package com.peoplepay360.employee;

import com.peoplepay360.attendance.AttendanceRepository;
import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.contract.Contract;
import com.peoplepay360.contract.ContractRepository;
import com.peoplepay360.employee.EmployeeDtos.*;
import com.peoplepay360.schedule.WorkingSchedule;
import com.peoplepay360.schedule.WorkingScheduleRepository;
import com.peoplepay360.security.OwnershipGuard;
import com.peoplepay360.security.SelfActionGuard;
import com.peoplepay360.timeoff.TimeOffAllocationRepository;
import com.peoplepay360.timeoff.TimeOffRequestRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class EmployeeService {
    private final EmployeeRepository employees;
    private final DepartmentRepository departments;
    private final EmployeeBankAccountRepository banks;
    private final ContractRepository contracts;
    private final AttendanceRepository attendance;
    private final TimeOffRequestRepository requests;
    private final TimeOffAllocationRepository allocations;
    private final WorkingScheduleRepository schedules;
    private final SelfActionGuard selfActionGuard;
    private final OwnershipGuard ownershipGuard;
    private final AuditService audit;

    public EmployeeService(EmployeeRepository employees, DepartmentRepository departments,
                           EmployeeBankAccountRepository banks, ContractRepository contracts,
                           AttendanceRepository attendance, TimeOffRequestRepository requests,
                           TimeOffAllocationRepository allocations, WorkingScheduleRepository schedules,
                           SelfActionGuard selfActionGuard, OwnershipGuard ownershipGuard, AuditService audit) {
        this.employees = employees;
        this.departments = departments;
        this.banks = banks;
        this.contracts = contracts;
        this.attendance = attendance;
        this.requests = requests;
        this.allocations = allocations;
        this.schedules = schedules;
        this.selfActionGuard = selfActionGuard;
        this.ownershipGuard = ownershipGuard;
        this.audit = audit;
    }

    @PreAuthorize("hasAuthority('employee.read.all')")
    @Transactional(readOnly = true)
    public Page<EmployeeSummary> list(String q, Long departmentId, String employeeType, Boolean active, Pageable pageable) {
        Specification<Employee> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.toLowerCase() + "%";
                ps.add(cb.or(
                        cb.like(cb.lower(root.get("employeeNo")), like),
                        cb.like(cb.lower(root.get("displayName")), like),
                        cb.like(cb.lower(root.get("workEmail")), like)));
            }
            if (departmentId != null) ps.add(cb.equal(root.get("departmentId"), departmentId));
            if (employeeType != null) ps.add(cb.equal(root.get("employeeType"), employeeType));
            if (active != null) ps.add(cb.equal(root.get("active"), active));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return employees.findAll(spec, pageable).map(this::toSummary);
    }

    @PreAuthorize("hasAuthority('employee.read.own')")
    @Transactional(readOnly = true)
    public EmployeeDetail get(Long id) {
        Employee e = employees.findById(id).orElseThrow(() -> ApiException.notFound("employee"));
        ownershipGuard.requireOwnedOr404(e.getId(), "employee.read.all", "employee", id);
        return toDetail(e);
    }

    @PreAuthorize("hasAuthority('employee.read.own')")
    @Transactional(readOnly = true)
    public EmployeeDetail summary(Long id) {
        Employee e = employees.findById(id).orElseThrow(() -> ApiException.notFound("employee"));
        ownershipGuard.requireOwnedOr404(e.getId(), "employee.read.all", "employee", id);
        return toDetail(e);
    }

    @PreAuthorize("hasAuthority('employee.create.all')")
    @Transactional
    public EmployeeDetail create(CreateEmployee in) {
        Employee e = new Employee();
        e.setEmployeeNo(nextEmployeeNo());
        e.setDisplayName(in.displayName());
        e.setDepartmentId(in.departmentId());
        e.setManagerId(in.managerId());
        e.setEmployeeType(in.employeeType() == null ? "FULL_TIME" : in.employeeType());
        e.setWorkingScheduleId(in.workingScheduleId());
        e.setHireDate(in.hireDate());
        e.setWorkEmail(in.workEmail());
        e.setJobTitle(in.jobTitle());
        e = employees.save(e);
        audit.record(Channel.UI, "CREATE", "employee", e.getId().toString(), "ALLOW", null, null, audit.toJson(in));
        return toDetail(e);
    }

    @PreAuthorize("hasAuthority('employee.update.all')")
    @Transactional
    public EmployeeDetail update(Long id, UpdateEmployee in) {
        Employee e = employees.findById(id).orElseThrow(() -> ApiException.notFound("employee"));
        if (in.displayName() != null) e.setDisplayName(in.displayName());
        if (in.departmentId() != null) e.setDepartmentId(in.departmentId());
        if (in.managerId() != null) e.setManagerId(in.managerId());
        if (in.employeeType() != null) e.setEmployeeType(in.employeeType());
        if (in.workingScheduleId() != null) e.setWorkingScheduleId(in.workingScheduleId());
        if (in.hireDate() != null) e.setHireDate(in.hireDate());
        if (in.workEmail() != null) e.setWorkEmail(in.workEmail());
        if (in.jobTitle() != null) e.setJobTitle(in.jobTitle());
        if (in.active() != null) e.setActive(in.active());
        audit.record(Channel.UI, "UPDATE", "employee", id.toString(), "ALLOW", null, null, audit.toJson(in));
        return toDetail(e);
    }

    @PreAuthorize("hasAuthority('employee.delete.all')")
    @Transactional
    public void deactivate(Long id) {
        Employee e = employees.findById(id).orElseThrow(() -> ApiException.notFound("employee"));
        e.setActive(false);
        audit.record(Channel.UI, "DEACTIVATE", "employee", id.toString(), "ALLOW", null, null, null);
    }

    @PreAuthorize("hasAuthority('employee.update.all')")
    @Transactional
    public void setBankAccount(Long id, BankInput in) {
        Employee e = employees.findById(id).orElseThrow(() -> ApiException.notFound("employee"));
        selfActionGuard.assertNotSelf(e.getId(), "SET_BANK", "employee");
        EmployeeBankAccount b = banks.findById(id).orElseGet(EmployeeBankAccount::new);
        b.setEmployeeId(id);
        b.setBankName(in.bankName());
        b.setAccountNumber(in.accountNumber());
        b.setIfsc(in.ifsc());
        String acct = in.accountNumber().replaceAll("\\s", "");
        b.setAccountLast4(acct.length() >= 4 ? acct.substring(acct.length() - 4) : acct);
        banks.save(b);
        audit.record(Channel.UI, "SET_BANK", "employee", id.toString(), "ALLOW", null, null, null);
    }

    @PreAuthorize("hasAuthority('employee.read.sensitive')")
    @Transactional(readOnly = true)
    public BankUnmasked unmaskBank(Long id) {
        EmployeeBankAccount b = banks.findById(id).orElseThrow(() -> ApiException.notFound("bank account"));
        audit.record(Channel.UI, "READ_SENSITIVE", "employee", id.toString(), "ALLOW", "bank unmask", null, null);
        return new BankUnmasked(b.getBankName(), b.getAccountNumber(), b.getIfsc());
    }

    // ----- departments -----
    @Transactional(readOnly = true)
    public List<DepartmentDto> listDepartments() {
        return departments.findAll().stream()
                .map(d -> new DepartmentDto(d.getId(), d.getName(), employees.countByDepartmentIdAndActiveTrue(d.getId())))
                .toList();
    }

    @PreAuthorize("hasAuthority('employee.update.all')")
    @Transactional
    public DepartmentDto createDepartment(CreateDepartment in) {
        Department d = new Department();
        d.setName(in.name());
        d = departments.save(d);
        return new DepartmentDto(d.getId(), d.getName(), 0);
    }

    // ----- mapping -----
    public EmployeeSummary toSummary(Employee e) {
        String deptName = e.getDepartmentId() == null ? null :
                departments.findById(e.getDepartmentId()).map(Department::getName).orElse(null);
        String managerName = e.getManagerId() == null ? null :
                employees.findById(e.getManagerId()).map(Employee::getDisplayName).orElse(null);
        return new EmployeeSummary(e.getId(), e.getEmployeeNo(), e.getDisplayName(), e.getJobTitle(),
                e.getDepartmentId(), deptName, e.getEmployeeType(), e.getManagerId(), managerName,
                e.isActive(), AvatarColor.forKey(e.getEmployeeNo()));
    }

    private EmployeeDetail toDetail(Employee e) {
        EmployeeSummary s = toSummary(e);
        String scheduleName = e.getWorkingScheduleId() == null ? null :
                schedules.findById(e.getWorkingScheduleId()).map(WorkingSchedule::getName).orElse(null);
        Long activeContractId = contracts.findByEmployeeId(e.getId()).stream()
                .filter(c -> "RUNNING".equals(c.getState()))
                .map(Contract::getId).findFirst().orElse(null);
        BankView bank = banks.findById(e.getId())
                .map(b -> new BankView(b.getBankName(), b.getAccountLast4(), true))
                .orElse(null);
        Counts counts = new Counts(
                contracts.countByEmployeeId(e.getId()),
                attendance.countByEmployeeId(e.getId()),
                requests.countByEmployeeId(e.getId()),
                allocations.countByEmployeeId(e.getId()));
        return new EmployeeDetail(s.id(), s.employeeNo(), s.displayName(), s.jobTitle(), s.departmentId(),
                s.departmentName(), s.employeeType(), s.managerId(), s.managerName(), s.active(), s.avatarColor(),
                e.getWorkEmail(), e.getHireDate(), e.getUserId(), e.getWorkingScheduleId(), scheduleName,
                activeContractId, bank, counts);
    }

    private String nextEmployeeNo() {
        long count = employees.count();
        String candidate;
        do {
            count++;
            candidate = "E-" + (1000 + count);
        } while (employees.findByEmployeeNo(candidate).isPresent());
        return candidate;
    }

    public Employee require(Long id) {
        return employees.findById(id).orElseThrow(() -> ApiException.notFound("employee"));
    }
}
