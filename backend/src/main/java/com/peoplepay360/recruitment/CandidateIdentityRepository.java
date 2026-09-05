package com.peoplepay360.recruitment;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CandidateIdentityRepository extends JpaRepository<CandidateIdentity, Long> {
}
