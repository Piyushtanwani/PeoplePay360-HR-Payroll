package com.peoplepay360.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UserPermissionGrantRepository extends JpaRepository<UserPermissionGrant, Long> {
    List<UserPermissionGrant> findByUserIdOrderByGrantedAtDesc(Long userId);
}
