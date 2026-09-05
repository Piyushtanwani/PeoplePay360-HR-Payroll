package com.peoplepay360.repository;

import com.peoplepay360.model.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<Employee, Long>, JpaSpecificationExecutor<Employee> {
    Optional<Employee> findByEmployeeNo(String employeeNo);
    long countByDepartmentIdAndActiveTrue(Long departmentId);

    /**
     * Ids of employees whose name or number matches. Attendance, payslips and contracts store only
     * an employeeId, so searching them by person means resolving ids here first and then filtering
     * on `employeeId in (...)`. The caller passes an already lowercased and escaped `%term%`.
     */
    @Query("select e.id from Employee e where lower(e.displayName) like :like escape '!' "
            + "or lower(e.employeeNo) like :like escape '!'")
    List<Long> findIdsMatching(String like);

    /** Ids in a department, for the department filter on the same id-only tables. */
    @Query("select e.id from Employee e where e.departmentId = :departmentId")
    List<Long> findIdsByDepartmentId(Long departmentId);

    /** Active employees with a working schedule: the population the absence detector walks. */
    @Query("select e from Employee e where e.active = true and e.workingScheduleId is not null")
    List<Employee> findActiveWithSchedule();
}
