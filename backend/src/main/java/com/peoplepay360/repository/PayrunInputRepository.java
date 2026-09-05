package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import com.peoplepay360.model.PayrunInput;

public interface PayrunInputRepository extends JpaRepository<PayrunInput, Long> {
    List<PayrunInput> findByPayrunId(Long payrunId);
    List<PayrunInput> findByPayrunIdAndEmployeeId(Long payrunId, Long employeeId);
    void deleteByPayrunIdAndSource(Long payrunId, String source);
}
