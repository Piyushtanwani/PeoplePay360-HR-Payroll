package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import com.peoplepay360.model.Role;

public interface RoleRepository extends JpaRepository<Role, Long> {
    Optional<Role> findByCode(String code);
}
