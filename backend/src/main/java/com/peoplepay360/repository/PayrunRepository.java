package com.peoplepay360.repository;

import com.peoplepay360.model.Payrun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface PayrunRepository extends JpaRepository<Payrun, Long>, JpaSpecificationExecutor<Payrun> {
    /** Guards deletion of a salary structure that historical payruns were computed from. */
    boolean existsByStructureId(Long structureId);
}
