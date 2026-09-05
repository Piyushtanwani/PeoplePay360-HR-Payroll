package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.Optional;
import com.peoplepay360.model.AppUser;

public interface AppUserRepository extends JpaRepository<AppUser, Long>, JpaSpecificationExecutor<AppUser> {
    Optional<AppUser> findByEmailIgnoreCase(String email);
    Optional<AppUser> findByEmployeeId(Long employeeId);
}
