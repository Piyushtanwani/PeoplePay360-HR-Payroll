package com.peoplepay360.employee;

import com.peoplepay360.common.PageResponse;
import com.peoplepay360.employee.EmployeeDtos.*;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class EmployeeController {
    private final EmployeeService service;
    public EmployeeController(EmployeeService service) { this.service = service; }

    @GetMapping("/departments")
    public List<DepartmentDto> departments() { return service.listDepartments(); }

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

    @GetMapping("/employees/{id}/summary")
    public EmployeeDetail summary(@PathVariable Long id) { return service.summary(id); }

    @PostMapping("/employees")
    public EmployeeDetail create(@Valid @RequestBody CreateEmployee in) { return service.create(in); }

    @PutMapping("/employees/{id}")
    public EmployeeDetail update(@PathVariable Long id, @RequestBody UpdateEmployee in) {
        return service.update(id, in);
    }

    @DeleteMapping("/employees/{id}")
    public void delete(@PathVariable Long id) { service.deactivate(id); }

    @PutMapping("/employees/{id}/bank-account")
    public void setBank(@PathVariable Long id, @Valid @RequestBody BankInput in) {
        service.setBankAccount(id, in);
    }

    @GetMapping("/employees/{id}/bank-account/unmask")
    public BankUnmasked unmask(@PathVariable Long id) { return service.unmaskBank(id); }
}
