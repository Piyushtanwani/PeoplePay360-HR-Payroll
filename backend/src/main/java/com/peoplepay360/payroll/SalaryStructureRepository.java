package com.peoplepay360.payroll;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SalaryStructureRepository extends JpaRepository<SalaryStructure, Long> {
    Optional<SalaryStructure> findByCode(String code);
    List<SalaryStructure> findByActiveTrue();
}
