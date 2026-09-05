package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.time.LocalDate;
import java.util.List;
import com.peoplepay360.model.Payrun;

public interface PayrunRepository extends JpaRepository<Payrun, Long>, JpaSpecificationExecutor<Payrun> {
    List<Payrun> findByStateNot(String state);
}
