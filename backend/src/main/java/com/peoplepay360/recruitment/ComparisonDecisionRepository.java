package com.peoplepay360.recruitment;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ComparisonDecisionRepository extends JpaRepository<ComparisonDecision, Long> {
    java.util.List<ComparisonDecision> findByCandidateId(Long candidateId);
}
