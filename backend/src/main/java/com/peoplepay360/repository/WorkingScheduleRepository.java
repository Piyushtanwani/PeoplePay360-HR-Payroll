package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.peoplepay360.model.WorkingSchedule;

public interface WorkingScheduleRepository extends JpaRepository<WorkingSchedule, Long> {
}
