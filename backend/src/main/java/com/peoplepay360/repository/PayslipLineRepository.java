package com.peoplepay360.repository;

import com.peoplepay360.model.PayslipLine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PayslipLineRepository extends JpaRepository<PayslipLine, Long> {
    List<PayslipLine> findByPayslipIdOrderBySequenceAsc(Long payslipId);
    /** Batch form, so listing a page of payslips is one query rather than one per row. */
    List<PayslipLine> findByPayslipIdInOrderBySequenceAsc(List<Long> payslipIds);
}
