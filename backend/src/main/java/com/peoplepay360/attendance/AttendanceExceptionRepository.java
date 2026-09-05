package com.peoplepay360.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AttendanceExceptionRepository extends JpaRepository<AttendanceException, Long> {
    @Query("select e from AttendanceException e where e.date between :from and :to")
    List<AttendanceException> findRange(LocalDate from, LocalDate to);
    Optional<AttendanceException> findByAttendanceId(Long attendanceId);
    List<AttendanceException> findByEmployeeIdAndDateBetween(Long employeeId, LocalDate from, LocalDate to);
}
