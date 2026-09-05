package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import com.peoplepay360.model.AiProfile;

public interface AiProfileRepository extends JpaRepository<AiProfile, Long> {
    Optional<AiProfile> findByIsDefaultTrue();
}
