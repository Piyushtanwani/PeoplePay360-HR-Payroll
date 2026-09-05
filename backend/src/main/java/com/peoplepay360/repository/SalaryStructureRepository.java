package com.peoplepay360.repository;

import com.peoplepay360.dto.PayrollDtos.SalaryStructureName;
import com.peoplepay360.model.SalaryStructure;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface SalaryStructureRepository
        extends JpaRepository<SalaryStructure, Long>, JpaSpecificationExecutor<SalaryStructure> {
    Optional<SalaryStructure> findByCode(String code);
    boolean existsByCodeIgnoreCase(String code);

    /**
     * Id and name only. Rules are mapped EAGER, so loading entities here would pull every rule of
     * every structure just to fill a dropdown; a projection keeps the picker to one small query.
     */
    @Query("select new com.peoplepay360.dto.PayrollDtos$SalaryStructureName(s.id, s.name) "
            + "from SalaryStructure s where s.active = true order by s.name asc")
    List<SalaryStructureName> findActiveNames();
}
