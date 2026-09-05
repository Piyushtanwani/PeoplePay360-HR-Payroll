package com.peoplepay360.payroll;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PayslipLineRepository extends JpaRepository<PayslipLine, Long> {
    List<PayslipLine> findByPayslipIdOrderBySequenceAsc(Long payslipId);
}
