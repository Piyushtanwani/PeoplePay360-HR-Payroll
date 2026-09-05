package com.peoplepay360.payroll;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SalaryStructureVersionRepository extends JpaRepository<SalaryStructureVersion, Long> {
    long countByStructureId(Long structureId);
}
