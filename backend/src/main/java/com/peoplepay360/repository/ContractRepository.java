package com.peoplepay360.repository;

import com.peoplepay360.model.Contract;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;

public interface ContractRepository extends JpaRepository<Contract, Long>, JpaSpecificationExecutor<Contract> {
    List<Contract> findByEmployeeId(Long employeeId);
    List<Contract> findByEmployeeIdAndStateIn(Long employeeId, List<String> states);
    long countByEmployeeId(Long employeeId);

    /** Headcount on a structure, shown on the salary-structure list. */
    long countBySalaryStructureIdAndState(Long salaryStructureId, String state);

    /** Guards deletion of a structure that live contracts point at. */
    boolean existsBySalaryStructureId(Long salaryStructureId);

    /** Structure headcounts in one query, so the list endpoint does not count per row. */
    @Query("select c.salaryStructureId, count(c) from Contract c "
            + "where c.state = 'RUNNING' and c.salaryStructureId in :structureIds group by c.salaryStructureId")
    List<Object[]> countRunningByStructureIds(List<Long> structureIds);

    /** Employees the dry run should simulate: a running contract on this structure covering the period. */
    @Query("select distinct c.employeeId from Contract c where c.salaryStructureId = :structureId "
            + "and c.state = 'RUNNING' and c.startDate <= :periodEnd "
            + "and (c.endDate is null or c.endDate >= :periodStart)")
    List<Long> findEmployeeIdsOnStructureInPeriod(Long structureId, LocalDate periodStart, LocalDate periodEnd);
}
