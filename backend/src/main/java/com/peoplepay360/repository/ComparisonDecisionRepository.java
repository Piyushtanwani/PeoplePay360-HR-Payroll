package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import com.peoplepay360.model.ComparisonDecision;

public interface ComparisonDecisionRepository extends JpaRepository<ComparisonDecision, Long> {
    java.util.List<ComparisonDecision> findByCandidateId(Long candidateId);
}
