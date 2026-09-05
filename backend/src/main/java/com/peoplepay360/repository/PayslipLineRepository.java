package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import com.peoplepay360.model.PayslipLine;

public interface PayslipLineRepository extends JpaRepository<PayslipLine, Long> {
    List<PayslipLine> findByPayslipIdOrderBySequenceAsc(Long payslipId);
}
