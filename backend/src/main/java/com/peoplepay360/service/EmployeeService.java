package com.peoplepay360.service;

import com.peoplepay360.repository.AttendanceRepository;
import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.model.Contract;
import com.peoplepay360.repository.ContractRepository;
import com.peoplepay360.dto.EmployeeDtos.*;
import com.peoplepay360.model.WorkingSchedule;
import com.peoplepay360.repository.WorkingScheduleRepository;
import com.peoplepay360.security.OwnershipGuard;
import com.peoplepay360.security.SelfActionGuard;
import com.peoplepay360.repository.TimeOffAllocationRepository;
import com.peoplepay360.repository.TimeOffRequestRepository;
import com.peoplepay360.common.Paging;
import com.peoplepay360.common.Specs;
import com.peoplepay360.dto.IdentityDtos.CreateUser;
import com.peoplepay360.dto.IdentityDtos.CreateUserResult;
import com.peoplepay360.dto.IdentityDtos.RoleAssign;
import com.peoplepay360.model.ContractTemplate;
import com.peoplepay360.repository.AppUserRepository;
import com.peoplepay360.repository.RoleRepository;
import com.peoplepay360.security.CurrentUser;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import com.peoplepay360.model.Department;
import com.peoplepay360.model.Employee;
import com.peoplepay360.model.EmployeeBankAccount;
import com.peoplepay360.repository.DepartmentRepository;
import com.peoplepay360.repository.EmployeeBankAccountRepository;
import com.peoplepay360.repository.EmployeeRepository;

@Service
public class EmployeeService {
    private static final Map<String, String> SORTS = Map.of(
            "employeeNo", "employeeNo", "displayName", "displayName", "jobTitle", "jobTitle",
            "employeeType", "employeeType", "active", "active", "hireDate", "hireDate",
            "departmentId", "departmentId");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("displayName"));

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
    private final ContractService contractService;
    private final ContractTemplateService templateService;
    private final AdminUserService adminUsers;
    private final AppUserRepository users;
    private final RoleRepository roles;
    private final CurrentUser currentUser;

    public EmployeeService(EmployeeRepository employees, DepartmentRepository departments,
                           EmployeeBankAccountRepository banks, ContractRepository contracts,
                           AttendanceRepository attendance, TimeOffRequestRepository requests,
                           TimeOffAllocationRepository allocations, WorkingScheduleRepository schedules,
                           SelfActionGuard selfActionGuard, OwnershipGuard ownershipGuard, AuditService audit,
                           ContractService contractService, ContractTemplateService templateService,
                           AdminUserService adminUsers, AppUserRepository users, RoleRepository roles,
                           CurrentUser currentUser) {
        this.contractService = contractService;
        this.templateService = templateService;
        this.adminUsers = adminUsers;
        this.users = users;
        this.roles = roles;
        this.currentUser = currentUser;
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
    public Page<EmployeeSummary> list(String q, Long departmentId, String employeeType, Boolean active,
                                      Pageable pageable) {
        Specification<Employee> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                ps.add(Specs.likeAny(cb, q, root.get("employeeNo"), root.get("displayName"), root.get("workEmail")));
            }
            if (departmentId != null) ps.add(cb.equal(root.get("departmentId"), departmentId));
            if (employeeType != null && !employeeType.isBlank()) {
                ps.add(cb.equal(root.get("employeeType"), employeeType));
            }
            if (active != null) ps.add(cb.equal(root.get("active"), active));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return employees.findAll(spec, Paging.normalise(pageable, DEFAULT_SORT, SORTS)).map(this::toSummary);
    }

    @PreAuthorize("hasAuthority('employee.read.own')")
    @Transactional(readOnly = true)
    public EmployeeDetail get(Long id) {
        Employee e = employees.findById(id).orElseThrow(() -> ApiException.notFound("employee"));
        ownershipGuard.requireOwnedOr404(e.getId(), "employee.read.all", "employee", id);
        return toDetail(e);
    }

    /**
     * Creates an employee and, optionally, everything that makes them a working member of staff:
     * a contract from a template and a login with a role.
     *
     * <p>All three happen in one transaction, so a failure part-way leaves no half-onboarded person.
     * The two optional steps check their own permissions explicitly, because calling an annotated method
     * on this same bean would bypass the proxy and therefore the check.
     */
    @PreAuthorize("hasAuthority('employee.create.all')")
    @Transactional
    public EmployeeDetail create(CreateEmployee in) {
        boolean wantsLogin = in.roleCode() != null && !in.roleCode().isBlank();
        if (wantsLogin) {
            assertMayCreateLogins();
            if (in.workEmail() == null || in.workEmail().isBlank()) {
                throw ApiException.validation("A work email is required to create a login and send the invite.");
            }
            roles.findByCode(in.roleCode())
                    .orElseThrow(() -> ApiException.validation("Unknown role: " + in.roleCode()));
            users.findByEmailIgnoreCase(in.workEmail()).ifPresent(u -> {
                throw ApiException.conflict("A user with the email " + in.workEmail() + " already exists.");
            });
        }
        ContractTemplate template = null;
        if (in.contractTemplateId() != null) {
            assertMayCreateContracts();
            template = templateService.requireActive(in.contractTemplateId());
            if (in.hireDate() == null && in.contractStartDate() == null) {
                throw ApiException.validation(
                        "A hire date or contract start date is required when applying a contract template.");
            }
        }

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

        Contract contract = null;
        if (template != null) {
            LocalDate start = in.contractStartDate() != null ? in.contractStartDate() : in.hireDate();
            contract = contractService.createRunningFromTemplate(e, template, in.wage(), start);
            if (e.getWorkingScheduleId() == null) e.setWorkingScheduleId(contract.getWorkingScheduleId());
        }

        CreateUserResult login = null;
        if (wantsLogin) {
            login = adminUsers.create(new CreateUser(in.workEmail(), in.displayName(), null,
                    in.roleCode(), e.getId(), true, true));
            e.setUserId(login.user().id());
        }

        OnboardingOutcome outcome = new OnboardingOutcome(
                login == null ? null : login.user().id(),
                login != null && login.inviteSent(),
                login == null ? null : login.inviteMessage(),
                contract == null ? null : contract.getId(),
                contract == null ? null : contract.getReference());
        return toDetail(e, outcome);
    }

    /**
     * Creates a login for someone who was onboarded without one, rather than making them a second
     * employee record.
     */
    @PreAuthorize("hasAuthority('employee.update.all')")
    @Transactional
    public EmployeeDetail createLogin(Long id, CreateLogin in) {
        assertMayCreateLogins();
        Employee e = employees.findById(id).orElseThrow(() -> ApiException.notFound("employee"));
        if (adminUsers.hasLogin(id)) {
            throw ApiException.conflict(e.getDisplayName() + " already has a login.");
        }
        if (e.getWorkEmail() == null || e.getWorkEmail().isBlank()) {
            throw ApiException.validation("Add a work email to " + e.getDisplayName() + " before creating a login.");
        }
        CreateUserResult login = adminUsers.create(new CreateUser(e.getWorkEmail(), e.getDisplayName(), null,
                in.roleCode(), id, true, true));
        e.setUserId(login.user().id());
        return toDetail(e, new OnboardingOutcome(login.user().id(), login.inviteSent(), login.inviteMessage(),
                null, null));
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
        if (in.roleCode() != null && !in.roleCode().isBlank()) {
            Long userId = users.findByEmployeeId(id).map(u -> u.getId()).orElse(null);
            if (userId == null) {
                throw ApiException.illegalState(e.getDisplayName()
                        + " has no login yet, so there is no role to change. Create a login first.");
            }
            adminUsers.assignRole(userId, new RoleAssign(in.roleCode()));
        }
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

    /**
     * HR setting someone else's bank details. Never one's own: an officer who can both approve a payrun
     * and redirect their own pay is the fraud path this guard exists for. Self-service has its own
     * route, which re-checks the password.
     */
    @PreAuthorize("hasAuthority('employee.update.all')")
    @Transactional
    public void setBankAccount(Long id, BankInput in) {
        Employee e = employees.findById(id).orElseThrow(() -> ApiException.notFound("employee"));
        selfActionGuard.assertNotSelf(e.getId(), "SET_BANK", "employee");
        writeBankAccount(id, in, "SET_BANK");
    }

    /**
     * The write itself, shared with self-service. Only the last four digits are stored in the clear;
     * the full number goes through the encrypting converter.
     *
     * <p>Not annotated: both callers check first, and a self-invoked annotated method would not be
     * checked at all.
     */
    @Transactional
    void writeBankAccount(Long id, BankInput in, String action) {
        EmployeeBankAccount b = banks.findById(id).orElseGet(EmployeeBankAccount::new);
        String previousLast4 = b.getAccountLast4();
        String account = in.accountNumber().replaceAll("\\s", "");
        if (account.length() < 4) throw ApiException.validation("That account number looks too short.");
        b.setEmployeeId(id);
        b.setBankName(in.bankName().trim());
        b.setAccountNumber(account);
        b.setIfsc(in.ifsc());
        b.setAccountLast4(account.substring(account.length() - 4));
        banks.save(b);
        audit.record(Channel.UI, action, "employee", id.toString(), "ALLOW", null,
                previousLast4 == null ? null : "****" + previousLast4, "****" + b.getAccountLast4());
    }

    /** Detail view for the caller's own record, bypassing the ownership guard the read endpoints apply. */
    @Transactional(readOnly = true)
    EmployeeDetail detailForSelf(Long id) {
        return toDetail(employees.findById(id).orElseThrow(() -> ApiException.notFound("employee")));
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
        departments.findByNameIgnoreCase(in.name().trim())
                .ifPresent(d -> { throw ApiException.conflict("A department with that name already exists."); });
        Department d = new Department();
        d.setName(in.name());
        d = departments.save(d);
        return new DepartmentDto(d.getId(), d.getName(), 0);
    }

    @PreAuthorize("hasAuthority('employee.update.all')")
    @Transactional
    public DepartmentDto updateDepartment(Long id, CreateDepartment in) {
        Department d = departments.findById(id).orElseThrow(() -> ApiException.notFound("department"));
        departments.findByNameIgnoreCase(in.name().trim())
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> { throw ApiException.conflict("A department with that name already exists."); });
        d.setName(in.name());
        d = departments.save(d);
        return new DepartmentDto(d.getId(), d.getName(), employees.countByDepartmentIdAndActiveTrue(d.getId()));
    }

    /** A department in use would orphan employee records, so deletion is blocked while staffed. */
    @PreAuthorize("hasAuthority('employee.delete.all')")
    @Transactional
    public void deleteDepartment(Long id) {
        departments.findById(id).orElseThrow(() -> ApiException.notFound("department"));
        long staffed = employees.countByDepartmentIdAndActiveTrue(id);
        if (staffed > 0) {
            throw ApiException.conflict("Move the " + staffed + " employee(s) in this department first.");
        }
        departments.deleteById(id);
    }

    // ----- mapping -----
    public EmployeeSummary toSummary(Employee e) {
        String deptName = e.getDepartmentId() == null ? null :
                departments.findById(e.getDepartmentId()).map(Department::getName).orElse(null);
        String managerName = e.getManagerId() == null ? null :
                employees.findById(e.getManagerId()).map(Employee::getDisplayName).orElse(null);
        return new EmployeeSummary(e.getId(), e.getEmployeeNo(), e.getDisplayName(), e.getJobTitle(),
                e.getDepartmentId(), deptName, e.getEmployeeType(), e.getManagerId(), managerName,
                e.isActive(), AvatarColor.forKey(e.getEmployeeNo()),
                new Counts(
                        contracts.countByEmployeeId(e.getId()),
                        attendance.countByEmployeeId(e.getId()),
                        requests.countByEmployeeId(e.getId()),
                        allocations.countByEmployeeId(e.getId())));
    }

    private EmployeeDetail toDetail(Employee e) {
        return toDetail(e, null);
    }

    private EmployeeDetail toDetail(Employee e, OnboardingOutcome onboarding) {
        EmployeeSummary s = toSummary(e);
        String scheduleName = e.getWorkingScheduleId() == null ? null :
                schedules.findById(e.getWorkingScheduleId()).map(WorkingSchedule::getName).orElse(null);
        Long activeContractId = contracts.findByEmployeeId(e.getId()).stream()
                .filter(c -> "RUNNING".equals(c.getState()))
                .map(Contract::getId).findFirst().orElse(null);
        BankView bank = banks.findById(e.getId())
                .map(b -> new BankView(b.getBankName(), b.getAccountLast4(), true))
                .orElse(null);
        String roleCode = users.findByEmployeeId(e.getId())
                .map(u -> u.getRole().getCode())
                .orElse(null);
        return new EmployeeDetail(s.id(), s.employeeNo(), s.displayName(), s.jobTitle(), s.departmentId(),
                s.departmentName(), s.employeeType(), s.managerId(), s.managerName(), s.active(), s.avatarColor(),
                e.getWorkEmail(), e.getHireDate(), e.getUserId(), roleCode, e.getWorkingScheduleId(), scheduleName,
                activeContractId, bank, s.counts(), onboarding);
    }

    /**
     * Creating a login is an identity action, so it needs the identity permission even though the caller
     * is on an employee endpoint. HR roles hold it; a role that does not gets a clear denial naming it.
     */
    private void assertMayCreateLogins() {
        if (!currentUser.hasAuthority("user.create")) {
            throw new com.peoplepay360.common.PermissionDeniedException("user.create");
        }
    }

    private void assertMayCreateContracts() {
        if (!currentUser.hasAuthority("contract.create.all")) {
            throw new com.peoplepay360.common.PermissionDeniedException("contract.create.all");
        }
        if (!currentUser.hasAuthority("contract.activate")) {
            throw new com.peoplepay360.common.PermissionDeniedException("contract.activate");
        }
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
