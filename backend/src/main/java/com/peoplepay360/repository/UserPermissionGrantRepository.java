package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import com.peoplepay360.model.UserPermissionGrant;

public interface UserPermissionGrantRepository extends JpaRepository<UserPermissionGrant, Long> {
    List<UserPermissionGrant> findByUserIdOrderByGrantedAtDesc(Long userId);
}
