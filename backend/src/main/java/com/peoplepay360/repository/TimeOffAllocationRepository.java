package com.peoplepay360.repository;

import com.peoplepay360.model.TimeOffAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface TimeOffAllocationRepository
        extends JpaRepository<TimeOffAllocation, Long>, JpaSpecificationExecutor<TimeOffAllocation> {
    List<TimeOffAllocation> findByEmployeeId(Long employeeId);
    long countByEmployeeId(Long employeeId);
    List<TimeOffAllocation> findByEmployeeIdAndTypeIdAndState(Long employeeId, Long typeId, String state);
}
