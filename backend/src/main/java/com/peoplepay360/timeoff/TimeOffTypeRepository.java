package com.peoplepay360.timeoff;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface TimeOffTypeRepository extends JpaRepository<TimeOffType, Long> {
    Optional<TimeOffType> findByCode(String code);
}
