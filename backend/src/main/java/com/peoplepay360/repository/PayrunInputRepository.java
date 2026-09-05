package com.peoplepay360.repository;

import com.peoplepay360.model.PayrunInput;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PayrunInputRepository extends JpaRepository<PayrunInput, Long> {
    List<PayrunInput> findByPayrunId(Long payrunId);
    List<PayrunInput> findByPayrunIdAndEmployeeId(Long payrunId, Long employeeId);
    /** Batch form for the payslip list. */
    List<PayrunInput> findByPayrunIdIn(List<Long> payrunIds);
    void deleteByPayrunIdAndSource(Long payrunId, String source);
}
