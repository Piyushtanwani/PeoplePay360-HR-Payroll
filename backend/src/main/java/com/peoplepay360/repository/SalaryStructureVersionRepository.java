package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.peoplepay360.model.SalaryStructureVersion;

public interface SalaryStructureVersionRepository extends JpaRepository<SalaryStructureVersion, Long> {
    long countByStructureId(Long structureId);
}
