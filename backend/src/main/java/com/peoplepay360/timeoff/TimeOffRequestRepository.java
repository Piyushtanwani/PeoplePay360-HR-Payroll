package com.peoplepay360.timeoff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.List;
public interface TimeOffRequestRepository extends JpaRepository<TimeOffRequest, Long>, JpaSpecificationExecutor<TimeOffRequest> {
    List<TimeOffRequest> findByEmployeeIdAndTypeIdAndState(Long employeeId, Long typeId, String state);
    List<TimeOffRequest> findByEmployeeIdAndState(Long employeeId, String state);
    long countByEmployeeId(Long employeeId);
    @Query("select r from TimeOffRequest r where r.employeeId = :emp and r.state = 'APPROVED' and r.startDate <= :end and r.endDate >= :start")
    List<TimeOffRequest> findApprovedOverlapping(Long emp, LocalDate start, LocalDate end);
}
