package com.peoplepay360.payroll;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.time.LocalDate;
import java.util.List;

public interface PayrunRepository extends JpaRepository<Payrun, Long>, JpaSpecificationExecutor<Payrun> {
    List<Payrun> findByStateNot(String state);
}
