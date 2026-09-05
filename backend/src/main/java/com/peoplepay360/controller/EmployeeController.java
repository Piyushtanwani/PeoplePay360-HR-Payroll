package com.peoplepay360.controller;

import com.peoplepay360.common.PageResponse;
import com.peoplepay360.dto.EmployeeDtos.*;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import com.peoplepay360.service.EmployeeService;

@RestController
@RequestMapping("/api")
public class EmployeeController {
    private final EmployeeService service;
    public EmployeeController(EmployeeService service) { this.service = service; }

    @GetMapping("/departments")
    public List<DepartmentDto> departments() { return service.listDepartments(); }

    @PutMapping("/departments/{id}")
    public DepartmentDto updateDepartment(@PathVariable Long id, @Valid @RequestBody CreateDepartment in) {
        return service.updateDepartment(id, in);
    }

    @DeleteMapping("/departments/{id}")
    public void deleteDepartment(@PathVariable Long id) { service.deleteDepartment(id); }

    @PostMapping("/departments")
    public DepartmentDto createDepartment(@Valid @RequestBody CreateDepartment in) {
        return service.createDepartment(in);
    }

    @GetMapping("/employees")
    public PageResponse<EmployeeSummary> list(@RequestParam(required = false) String q,
                                              @RequestParam(required = false) Long departmentId,
                                              @RequestParam(required = false) String employeeType,
                                              @RequestParam(required = false) Boolean active,
                                              Pageable pageable) {
        return PageResponse.of(service.list(q, departmentId, employeeType, active, pageable));
    }

    @GetMapping("/employees/{id}")
    public EmployeeDetail get(@PathVariable Long id) { return service.get(id); }

    /**
     * Kept alongside the detail route because the assistant's tool service calls it by name.
     * It returns the same record without the bank block, which no summary view needs.
     */
    @GetMapping("/employees/{id}/summary")
    public EmployeeDetail summary(@PathVariable Long id) {
        EmployeeDetail d = service.get(id);
        return new EmployeeDetail(d.id(), d.employeeNo(), d.displayName(), d.jobTitle(), d.departmentId(),
                d.departmentName(), d.employeeType(), d.managerId(), d.managerName(), d.active(), d.avatarColor(),
                d.workEmail(), d.hireDate(), d.userId(), d.roleCode(), d.workingScheduleId(),
                d.workingScheduleName(), d.activeContractId(), null, d.counts(), null);
    }

    @PostMapping("/employees")
    public EmployeeDetail create(@Valid @RequestBody CreateEmployee in) { return service.create(in); }

    @PutMapping("/employees/{id}")
    public EmployeeDetail update(@PathVariable Long id, @RequestBody UpdateEmployee in) {
        return service.update(id, in);
    }

    @DeleteMapping("/employees/{id}")
    public void delete(@PathVariable Long id) { service.deactivate(id); }

    /** Creates a login for an employee onboarded without one. */
    @PostMapping("/employees/{id}/login")
    public EmployeeDetail createLogin(@PathVariable Long id, @Valid @RequestBody CreateLogin in) {
        return service.createLogin(id, in);
    }

    @PutMapping("/employees/{id}/bank-account")
    public void setBank(@PathVariable Long id, @Valid @RequestBody BankInput in) {
        service.setBankAccount(id, in);
    }

    @GetMapping("/employees/{id}/bank-account/unmask")
    public BankUnmasked unmask(@PathVariable Long id) { return service.unmaskBank(id); }
}
