package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import com.peoplepay360.model.SalaryRule;

public interface SalaryRuleRepository extends JpaRepository<SalaryRule, Long> {
    List<SalaryRule> findByStructureIdOrderBySequenceAsc(Long structureId);
}
