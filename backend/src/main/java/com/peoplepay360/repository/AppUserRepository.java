package com.peoplepay360.repository;

import com.peoplepay360.model.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long>, JpaSpecificationExecutor<AppUser> {
    Optional<AppUser> findByEmailIgnoreCase(String email);
    Optional<AppUser> findByEmployeeId(Long employeeId);
    /** Admin dashboard tile. */
    long countByActiveTrue();
    /** Employee ids that already have a login, for the invitable-employee picker. */
    @org.springframework.data.jpa.repository.Query("select u.employeeId from AppUser u where u.employeeId is not null")
    List<Long> findLinkedEmployeeIds();
}
