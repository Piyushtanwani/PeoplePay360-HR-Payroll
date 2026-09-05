package com.peoplepay360.repository;

import com.peoplepay360.model.SalaryRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface SalaryRuleRepository extends JpaRepository<SalaryRule, Long>, JpaSpecificationExecutor<SalaryRule> {
}
