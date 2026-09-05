package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import com.peoplepay360.model.Department;

public interface DepartmentRepository extends JpaRepository<Department, Long> {
    Optional<Department> findByName(String name);
}
