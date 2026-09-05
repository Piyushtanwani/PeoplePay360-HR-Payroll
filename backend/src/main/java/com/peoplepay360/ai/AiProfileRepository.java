package com.peoplepay360.ai;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AiProfileRepository extends JpaRepository<AiProfile, Long> {
    Optional<AiProfile> findByIsDefaultTrue();
}
