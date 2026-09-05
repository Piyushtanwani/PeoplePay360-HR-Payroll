package com.peoplepay360.payroll;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PayrunIssueRepository extends JpaRepository<PayrunIssue, Long> {
    List<PayrunIssue> findByPayrunId(Long payrunId);
    List<PayrunIssue> findByPayrunIdAndSeverityAndStatus(Long payrunId, String severity, String status);
    List<PayrunIssue> findByPayrunIdAndStatus(Long payrunId, String status);
    void deleteByPayrunId(Long payrunId);
}
