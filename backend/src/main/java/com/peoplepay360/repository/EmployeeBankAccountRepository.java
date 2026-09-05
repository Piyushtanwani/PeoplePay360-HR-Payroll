package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.peoplepay360.model.EmployeeBankAccount;

public interface EmployeeBankAccountRepository extends JpaRepository<EmployeeBankAccount, Long> {
}
