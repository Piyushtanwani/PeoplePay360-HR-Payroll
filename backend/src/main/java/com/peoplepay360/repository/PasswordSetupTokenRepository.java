package com.peoplepay360.repository;

import com.peoplepay360.model.PasswordSetupToken;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PasswordSetupTokenRepository extends JpaRepository<PasswordSetupToken, Long> {
    Optional<PasswordSetupToken> findByTokenHash(String tokenHash);
    List<PasswordSetupToken> findByUserIdAndUsedAtIsNull(Long userId);
}
