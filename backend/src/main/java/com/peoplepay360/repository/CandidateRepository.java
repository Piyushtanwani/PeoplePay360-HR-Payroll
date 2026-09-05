package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import com.peoplepay360.model.Candidate;

public interface CandidateRepository extends JpaRepository<Candidate, Long> {
    java.util.List<Candidate> findByOpeningId(Long openingId);
}
