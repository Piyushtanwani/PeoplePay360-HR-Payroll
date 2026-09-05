package com.peoplepay360.contract;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.time.LocalDate;
import java.util.List;

public interface ContractRepository extends JpaRepository<Contract, Long>, JpaSpecificationExecutor<Contract> {
    List<Contract> findByEmployeeId(Long employeeId);
    List<Contract> findByEmployeeIdAndStateIn(Long employeeId, List<String> states);
    long countByEmployeeId(Long employeeId);
}
