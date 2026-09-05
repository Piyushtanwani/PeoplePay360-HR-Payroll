package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import com.peoplepay360.model.Payslip;

public interface PayslipRepository extends JpaRepository<Payslip, Long>, JpaSpecificationExecutor<Payslip> {
    List<Payslip> findByPayrunId(Long payrunId);
    void deleteByPayrunId(Long payrunId);
    List<Payslip> findByEmployeeId(Long employeeId);
    @org.springframework.data.jpa.repository.Query("select p from Payslip p where p.employeeId = :emp and p.periodStart <= :end and p.periodEnd >= :start")
    List<Payslip> findOverlapping(Long emp, LocalDate start, LocalDate end);
}
