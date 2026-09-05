package com.peoplepay360.timeoff;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface TimeOffAllocationRepository extends JpaRepository<TimeOffAllocation, Long> {
    List<TimeOffAllocation> findByEmployeeId(Long employeeId);
    long countByEmployeeId(Long employeeId);
    List<TimeOffAllocation> findByEmployeeIdAndTypeIdAndState(Long employeeId, Long typeId, String state);
}
