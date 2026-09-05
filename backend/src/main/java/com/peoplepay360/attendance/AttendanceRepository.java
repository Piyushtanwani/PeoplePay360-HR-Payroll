package com.peoplepay360.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface AttendanceRepository extends JpaRepository<Attendance, Long>, JpaSpecificationExecutor<Attendance> {
    Optional<Attendance> findByEmployeeIdAndCheckOutIsNull(Long employeeId);
    long countByEmployeeId(Long employeeId);
    List<Attendance> findByEmployeeIdAndWorkDate(Long employeeId, LocalDate workDate);
    @Query("select a from Attendance a where a.employeeId = :emp and a.workDate between :from and :to")
    List<Attendance> findRange(Long emp, LocalDate from, LocalDate to);
    @Query("select a from Attendance a where a.workDate between :from and :to")
    List<Attendance> findAllInRange(LocalDate from, LocalDate to);
}
