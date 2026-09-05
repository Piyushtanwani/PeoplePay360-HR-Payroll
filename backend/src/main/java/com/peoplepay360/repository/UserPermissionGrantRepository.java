package com.peoplepay360.repository;

import com.peoplepay360.model.UserPermissionGrant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;

public interface UserPermissionGrantRepository extends JpaRepository<UserPermissionGrant, Long> {
    List<UserPermissionGrant> findByUserIdOrderByGrantedAtDesc(Long userId);
    /** Admin dashboard tile: live grants about to lapse. */
    long countByRevokedAtIsNullAndExpiresAtBetween(OffsetDateTime from, OffsetDateTime to);
}
