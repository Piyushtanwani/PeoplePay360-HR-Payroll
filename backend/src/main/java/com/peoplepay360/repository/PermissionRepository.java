package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.peoplepay360.model.Permission;

public interface PermissionRepository extends JpaRepository<Permission, String> {
}
