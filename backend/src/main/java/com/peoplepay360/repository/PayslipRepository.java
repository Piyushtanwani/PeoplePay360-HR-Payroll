package com.peoplepay360.repository;

import com.peoplepay360.model.Payslip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PayslipRepository extends JpaRepository<Payslip, Long>, JpaSpecificationExecutor<Payslip> {
    List<Payslip> findByPayrunId(Long payrunId);
    void deleteByPayrunId(Long payrunId);
    List<Payslip> findByEmployeeId(Long employeeId);

    @Query("select p from Payslip p where p.employeeId = :emp and p.periodStart <= :end and p.periodEnd >= :start")
    List<Payslip> findOverlapping(Long emp, LocalDate start, LocalDate end);

    /** Baseline for a dry run and for the variance check: the employee's most recent payslip. */
    Optional<Payslip> findTopByEmployeeIdOrderByPeriodEndDesc(Long employeeId);

    /** Last three payslips for the employee dashboard. */
    List<Payslip> findTop3ByEmployeeIdOrderByPeriodEndDesc(Long employeeId);

    /** Trend and KPI source, replacing repeated full-table scans in the dashboard. */
    @Query("select p from Payslip p where p.periodStart >= :from and p.periodEnd <= :to")
    List<Payslip> findInRange(LocalDate from, LocalDate to);
}
