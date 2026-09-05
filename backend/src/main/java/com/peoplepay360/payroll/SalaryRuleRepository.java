package com.peoplepay360.payroll;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SalaryRuleRepository extends JpaRepository<SalaryRule, Long> {
    List<SalaryRule> findByStructureIdOrderBySequenceAsc(Long structureId);
}
