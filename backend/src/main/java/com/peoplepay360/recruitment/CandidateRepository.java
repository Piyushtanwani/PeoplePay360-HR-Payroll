package com.peoplepay360.recruitment;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CandidateRepository extends JpaRepository<Candidate, Long> {
    java.util.List<Candidate> findByOpeningId(Long openingId);
}
