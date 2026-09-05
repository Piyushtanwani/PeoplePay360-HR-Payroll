package com.peoplepay360.payroll;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PayrunInputRepository extends JpaRepository<PayrunInput, Long> {
    List<PayrunInput> findByPayrunId(Long payrunId);
    List<PayrunInput> findByPayrunIdAndEmployeeId(Long payrunId, Long employeeId);
    void deleteByPayrunIdAndSource(Long payrunId, String source);
}
