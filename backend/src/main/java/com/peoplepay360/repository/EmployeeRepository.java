package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.Optional;
import com.peoplepay360.model.Employee;

public interface EmployeeRepository extends JpaRepository<Employee, Long>, JpaSpecificationExecutor<Employee> {
    Optional<Employee> findByEmployeeNo(String employeeNo);
    long countByDepartmentIdAndActiveTrue(Long departmentId);
    long countByActiveTrue();
}
