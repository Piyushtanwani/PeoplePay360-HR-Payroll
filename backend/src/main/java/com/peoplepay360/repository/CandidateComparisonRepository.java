package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import com.peoplepay360.model.CandidateComparison;

public interface CandidateComparisonRepository extends JpaRepository<CandidateComparison, Long> {
}
