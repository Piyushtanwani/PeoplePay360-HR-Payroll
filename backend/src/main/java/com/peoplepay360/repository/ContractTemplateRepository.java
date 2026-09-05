package com.peoplepay360.repository;

import com.peoplepay360.model.ContractTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ContractTemplateRepository
        extends JpaRepository<ContractTemplate, Long>, JpaSpecificationExecutor<ContractTemplate> {
    boolean existsByNameIgnoreCase(String name);
}
