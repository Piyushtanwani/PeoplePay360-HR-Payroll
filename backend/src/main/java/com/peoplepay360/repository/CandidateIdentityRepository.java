package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import com.peoplepay360.model.CandidateIdentity;

public interface CandidateIdentityRepository extends JpaRepository<CandidateIdentity, Long> {
}
