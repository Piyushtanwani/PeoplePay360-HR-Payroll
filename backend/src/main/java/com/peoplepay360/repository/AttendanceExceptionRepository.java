package com.peoplepay360.repository;

import com.peoplepay360.model.AttendanceException;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDate;
import java.util.Optional;

public interface AttendanceExceptionRepository
        extends JpaRepository<AttendanceException, Long>, JpaSpecificationExecutor<AttendanceException> {
    Optional<AttendanceException> findByAttendanceId(Long attendanceId);
    /** Idempotency guard for the absence detector and the exception sync. */
    boolean existsByEmployeeIdAndDateAndType(Long employeeId, LocalDate date, String type);
    Optional<AttendanceException> findByEmployeeIdAndDateAndType(Long employeeId, LocalDate date, String type);
}
