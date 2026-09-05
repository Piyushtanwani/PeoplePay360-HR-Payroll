package com.peoplepay360.repository;

import com.peoplepay360.model.WorkingSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface WorkingScheduleRepository
        extends JpaRepository<WorkingSchedule, Long>, JpaSpecificationExecutor<WorkingSchedule> {
    boolean existsByNameIgnoreCase(String name);
}
